// Serveur multijoueur « Propre vs Sale ».
//
// Role : gestionnaire de salons (lobby) + relais de messages. Il NE simule PAS
// le monde : le premier joueur d'un salon est le « host » et son client fait
// autorite sur les ennemis / projectiles / taches. Le serveur se contente de :
//   - creer / rejoindre des salons par code,
//   - tenir la liste des joueurs (pseudo, couleur, pret),
//   - lancer la partie (genere une seed partagee, designe le host),
//   - relayer les messages in-game aux autres membres du salon,
//   - gerer les departs / deconnexions.
//
// Deployable : ecoute process.env.PORT (defaut 8787). Health check sur GET /.

import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const MAX_PLAYERS = 8;
const ROOM_CODE_LEN = 4;

// Types de messages relayes tels quels aux autres membres du salon (in-game).
// Le serveur les estampille de l'id emetteur et les rediffuse sans les lire.
const RELAY_TYPES = new Set([
  'state',       // transform d'un joueur (~20 Hz)
  'world',       // snapshot host : ennemis / projectiles / taches nettoyees
  'clean',       // taches nettoyees par un client
  'enemyHit',    // un client a frappe un ennemi (coop -> host)
  'hit',         // degats infliges a un joueur (PvE, depuis le host)
  'pvpHit',      // degats joueur -> joueur (PvP)
  'enemyKilled', // mort d'un ennemi
  'swing',       // animation de coup
  'died',        // mort d'un joueur
  'respawn',     // reapparition d'un joueur
  'levelChange', // transition de niveau (host)
  'gameover',
  'victory',
  'chat',
]);

/** @type {Map<string, Room>} */
const rooms = new Map();

let _idSeq = 1;
function newId() {
  return `p${_idSeq++}_${Math.random().toString(36).slice(2, 8)}`;
}

function newRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 ambigus
  let code;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LEN; i++) {
      code += alphabet[(Math.random() * alphabet.length) | 0];
    }
  } while (rooms.has(code));
  return code;
}

class Room {
  constructor(code, mode) {
    this.code = code;
    this.mode = mode === 'pvp' ? 'pvp' : 'coop';
    this.hostId = null;
    this.started = false;
    this.seed = 0;
    /** @type {Map<string, {id,name,color,ready,ws}>} */
    this.players = new Map();
  }

  publicPlayers() {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, ready: p.ready,
      isHost: p.id === this.hostId,
    }));
  }

  broadcast(obj, exceptId = null) {
    const data = JSON.stringify(obj);
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      if (p.ws.readyState === p.ws.OPEN) p.ws.send(data);
    }
  }
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function sanitizeName(name) {
  return String(name || 'Joueur').trim().slice(0, 24) || 'Joueur';
}
function sanitizeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4fc3f7';
}

function leaveRoom(ws) {
  const room = ws._room;
  const id = ws._id;
  if (!room || !room.players.has(id)) return;

  room.players.delete(id);
  ws._room = null;

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  // Si le host part, on termine la partie en cours et on revient au lobby.
  if (room.hostId === id) {
    if (room.started) {
      room.started = false;
      room.broadcast({ type: 'hostLeft' });
    }
    // Reassigne un host (le plus ancien restant) pour permettre une nouvelle partie.
    room.hostId = room.players.keys().next().value;
  }

  room.broadcast({ type: 'players', list: room.publicPlayers(), hostId: room.hostId });
}

function handleMessage(ws, msg) {
  const { type } = msg;

  // --- Lobby ---
  if (type === 'create') {
    const code = newRoomCode();
    const room = new Room(code, msg.mode);
    rooms.set(code, room);

    const id = ws._id;
    room.hostId = id;
    room.players.set(id, {
      id, name: sanitizeName(msg.name), color: sanitizeColor(msg.color),
      ready: true, ws,
    });
    ws._room = room;

    send(ws, { type: 'joined', id, code, isHost: true, mode: room.mode });
    room.broadcast({ type: 'players', list: room.publicPlayers(), hostId: room.hostId });
    return;
  }

  if (type === 'join') {
    const code = String(msg.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) { send(ws, { type: 'error', msg: 'Salon introuvable.' }); return; }
    if (room.started) { send(ws, { type: 'error', msg: 'La partie a deja commence.' }); return; }
    if (room.players.size >= MAX_PLAYERS) { send(ws, { type: 'error', msg: 'Salon plein.' }); return; }

    const id = ws._id;
    room.players.set(id, {
      id, name: sanitizeName(msg.name), color: sanitizeColor(msg.color),
      ready: false, ws,
    });
    ws._room = room;

    send(ws, { type: 'joined', id, code, isHost: false, mode: room.mode });
    room.broadcast({ type: 'players', list: room.publicPlayers(), hostId: room.hostId });
    return;
  }

  const room = ws._room;
  if (!room) return; // toute la suite necessite d'etre dans un salon

  if (type === 'setReady') {
    const p = room.players.get(ws._id);
    if (p) p.ready = !!msg.ready;
    room.broadcast({ type: 'players', list: room.publicPlayers(), hostId: room.hostId });
    return;
  }

  if (type === 'setMode') {
    if (ws._id === room.hostId && !room.started) {
      room.mode = msg.mode === 'pvp' ? 'pvp' : 'coop';
      room.broadcast({ type: 'mode', mode: room.mode });
      room.broadcast({ type: 'players', list: room.publicPlayers(), hostId: room.hostId });
    }
    return;
  }

  if (type === 'start') {
    if (ws._id !== room.hostId || room.started) return;
    room.started = true;
    room.seed = (Math.random() * 0xffffffff) >>> 0;
    room.broadcast({
      type: 'start',
      mode: room.mode,
      seed: room.seed,
      hostId: room.hostId,
      players: room.publicPlayers(),
    });
    return;
  }

  if (type === 'leave') {
    leaveRoom(ws);
    return;
  }

  // --- In-game : relais pur vers les autres membres ---
  if (RELAY_TYPES.has(type)) {
    msg.id = ws._id; // estampille l'emetteur (ecrase toute valeur cliente)
    room.broadcast(msg, ws._id);
  }
}

// --- Serveur HTTP (health) + upgrade WebSocket ---
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws._id = newId();
  ws._room = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    try {
      handleMessage(ws, msg);
    } catch (err) {
      console.error('[handleMessage]', err);
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

// Ping/pong : ferme les connexions mortes (evite les salons fantomes).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`[propre-vs-sale] serveur multijoueur sur le port ${PORT}`);
});
