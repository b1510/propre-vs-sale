// Client WebSocket : connexion au serveur de salons, emission/reception de
// messages JSON typés, mini emetteur d'evenements (on/off/emit).
//
// Usage :
//   const net = new NetClient();
//   net.on('joined', (m) => ...);
//   await net.connect();
//   net.create({ name, color, mode });
//
// L'URL vient de import.meta.env.VITE_SERVER_URL ; sinon on deduit une valeur
// raisonnable (localhost en dev, meme hote en wss: en prod).

import { MSG } from './protocol.js';

function defaultUrl() {
  const env = import.meta.env.VITE_SERVER_URL;
  if (env) return env;
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    // En dev (vite), le serveur tourne sur 8787. En prod, on suppose le meme hote.
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'ws://localhost:8787';
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${hostname}`;
  }
  return 'ws://localhost:8787';
}

export default class NetClient {
  constructor(url = defaultUrl()) {
    this.url = url;
    this.ws = null;
    this.id = null;
    this.code = null;
    this.isHost = false;
    this.mode = 'coop';
    this.connected = false;
    this._handlers = new Map(); // type -> Set<fn>
    this._sendThrottle = new Map(); // type -> dernier envoi (ms)
  }

  // Connexion. Resout quand le socket est ouvert, rejette en cas d'echec.
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.addEventListener('open', () => {
        this.connected = true;
        settled = true;
        resolve();
      });

      this.ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg.type !== 'string') return;
        this._onMessage(msg);
      });

      this.ws.addEventListener('close', () => {
        this.connected = false;
        this.emit('disconnected', {});
      });

      this.ws.addEventListener('error', (err) => {
        if (!settled) { settled = true; reject(err); }
        this.emit('neterror', err);
      });
    });
  }

  _onMessage(msg) {
    // Met a jour l'etat interne pour les messages de lobby cle.
    if (msg.type === MSG.JOINED) {
      this.id = msg.id;
      this.code = msg.code;
      this.isHost = !!msg.isHost;
      this.mode = msg.mode;
    } else if (msg.type === MSG.START) {
      this.mode = msg.mode;
      this.isHost = msg.hostId === this.id;
    } else if (msg.type === MSG.PLAYERS && msg.hostId) {
      this.isHost = msg.hostId === this.id;
    }
    this.emit(msg.type, msg);
  }

  // --- Emetteur d'evenements ---
  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    this._handlers.get(type)?.delete(fn);
  }
  emit(type, payload) {
    const set = this._handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }

  // --- Envoi ---
  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // Envoi limite en frequence (Hz) par type : utile pour `state`/`world`.
  sendThrottled(obj, hz) {
    const now = performance.now();
    const minGap = 1000 / hz;
    const last = this._sendThrottle.get(obj.type) || 0;
    if (now - last < minGap) return false;
    this._sendThrottle.set(obj.type, now);
    this.send(obj);
    return true;
  }

  // --- Helpers lobby ---
  create({ name, color, mode }) { this.send({ type: MSG.CREATE, name, color, mode }); }
  join({ code, name, color }) { this.send({ type: MSG.JOIN, code, name, color }); }
  setReady(ready) { this.send({ type: MSG.SET_READY, ready }); }
  setMode(mode) { this.send({ type: MSG.SET_MODE, mode }); }
  start() { this.send({ type: MSG.START }); }
  leave() { this.send({ type: MSG.LEAVE }); }

  close() {
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
    this.connected = false;
  }
}
