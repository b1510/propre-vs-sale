// Lobby multijoueur : ecrans « reseau » (creer / rejoindre) et « salon » (attente).
// Gere le cycle de vie du NetClient jusqu'au lancement de la partie, puis passe
// la main a Game via le callback onStart.

import NetClient from '../net/NetClient.js';
import { MSG, MODE } from '../net/protocol.js';

const NAME_KEY = 'pvs_pseudo';
const COLOR_KEY = 'pvs_color';
const PALETTE = ['#4fc3f7', '#ff8a65', '#81c784', '#ba68c8', '#ffd54a', '#f06292', '#4db6ac', '#fff'];

export default class Lobby {
  constructor() {
    this.net = null;
    this.onStart = null; // (ctx) => void
    this.onBack = null;  // () => void  (retour menu principal)
    this.selectedMode = MODE.COOP;
    this.players = [];
    this.selfId = null;
    this.isHost = false;
    this.started = false;

    this._cache();
    this._wire();
  }

  _cache() {
    this.networkScreen = document.getElementById('networkScreen');
    this.lobbyScreen = document.getElementById('lobbyScreen');
    this.networkStatus = document.getElementById('networkStatus');

    this.netName = document.getElementById('netName');
    this.netColor = document.getElementById('netColor');
    this.netCode = document.getElementById('netCode');
    this.modeCoop = document.getElementById('modeCoop');
    this.modePvp = document.getElementById('modePvp');

    this.btnCreate = document.getElementById('btnCreateRoom');
    this.btnJoin = document.getElementById('btnJoinRoom');
    this.btnNetBack = document.getElementById('btnNetBack');

    this.lobbyCode = document.getElementById('lobbyCode');
    this.lobbyModeEl = document.getElementById('lobbyMode');
    this.lobbyPlayers = document.getElementById('lobbyPlayers');
    this.lobbyHint = document.getElementById('lobbyHint');
    this.btnReady = document.getElementById('btnReady');
    this.btnStart = document.getElementById('btnStart');
    this.btnLeave = document.getElementById('btnLeaveLobby');
  }

  _wire() {
    this.netName.value = localStorage.getItem(NAME_KEY) || '';
    this.netColor.value = localStorage.getItem(COLOR_KEY) ||
      PALETTE[(Math.random() * PALETTE.length) | 0];

    this.modeCoop.addEventListener('click', () => this._setMode(MODE.COOP));
    this.modePvp.addEventListener('click', () => this._setMode(MODE.PVP));

    this.btnCreate.addEventListener('click', () => this._create());
    this.btnJoin.addEventListener('click', () => this._join());
    this.btnNetBack.addEventListener('click', () => this._back());

    this.btnReady.addEventListener('click', () => this._toggleReady());
    this.btnStart.addEventListener('click', () => this.net?.start());
    this.btnLeave.addEventListener('click', () => this._leave());
  }

  // --- Affichage des ecrans ---
  open() {
    this.started = false;
    this.networkScreen.classList.remove('hidden');
    this.lobbyScreen.classList.add('hidden');
    this.networkStatus.textContent = 'Choisis ton pseudo, puis crée ou rejoins un salon.';
  }
  _hideAll() {
    this.networkScreen.classList.add('hidden');
    this.lobbyScreen.classList.add('hidden');
  }

  _setMode(mode) {
    this.selectedMode = mode;
    this.modeCoop.classList.toggle('active', mode === MODE.COOP);
    this.modePvp.classList.toggle('active', mode === MODE.PVP);
    // En salon, seul le host change le mode.
    if (this.net && this.isHost) this.net.setMode(mode);
  }

  _credentials() {
    const name = (this.netName.value || '').trim().slice(0, 24) || 'Joueur';
    const color = this.netColor.value || '#4fc3f7';
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(COLOR_KEY, color);
    this.name = name;
    this.color = color;
    return { name, color };
  }

  async _ensureConnected() {
    if (this.net && this.net.connected) return true;
    this.net = new NetClient();
    this._bindNet();
    this.networkStatus.textContent = 'Connexion au serveur…';
    try {
      await this.net.connect();
      return true;
    } catch {
      this.networkStatus.textContent =
        '❌ Serveur injoignable. Vérifie qu\'il tourne (VITE_SERVER_URL).';
      this.net = null;
      return false;
    }
  }

  _bindNet() {
    this.net.on(MSG.JOINED, (m) => {
      this.selfId = m.id;
      this.isHost = m.isHost;
      this.selectedMode = m.mode;
      this._showLobby();
    });
    this.net.on(MSG.PLAYERS, (m) => {
      this.players = m.list;
      this.isHost = m.hostId === this.selfId;
      this._renderPlayers();
    });
    this.net.on(MSG.MODE, (m) => {
      this.selectedMode = m.mode;
      this._updateModeLabel();
    });
    this.net.on(MSG.ERROR, (m) => {
      this.networkStatus.textContent = '❌ ' + (m.msg || 'Erreur.');
    });
    this.net.on(MSG.START, (m) => {
      this.started = true;
      this._hideAll();
      if (this.onStart) {
        this.onStart({
          net: this.net,
          mode: m.mode,
          seed: m.seed,
          players: m.players,
          selfId: this.selfId,
          isHost: m.hostId === this.selfId,
          name: this.name,
          color: this.color,
        });
      }
    });
    this.net.on(MSG.HOST_LEFT, () => {
      // Renvoye au lobby si la partie tournait ; sinon simple info.
      this.networkStatus.textContent = 'L\'hôte a quitté la partie.';
    });
    this.net.on('disconnected', () => {
      if (!this.started) this.networkStatus.textContent = '❌ Connexion perdue.';
    });
  }

  async _create() {
    const cred = this._credentials();
    if (!(await this._ensureConnected())) return;
    this.net.create({ ...cred, mode: this.selectedMode });
  }

  async _join() {
    const cred = this._credentials();
    const code = (this.netCode.value || '').trim().toUpperCase();
    if (!code) { this.netCode.focus(); return; }
    if (!(await this._ensureConnected())) return;
    this.net.join({ code, ...cred });
  }

  _showLobby() {
    this.networkScreen.classList.add('hidden');
    this.lobbyScreen.classList.remove('hidden');
    this.lobbyCode.textContent = this.net.code || '----';
    this._updateModeLabel();
    this._renderPlayers();
    this._readyState = this.isHost; // host considere pret d'office
    this.btnReady.classList.toggle('is-ready', this._readyState);
    this.btnReady.textContent = this._readyState ? 'PAS PRÊT' : 'PRÊT';
  }

  _updateModeLabel() {
    const label = this.selectedMode === MODE.PVP ? 'PvP (chacun pour soi)' : 'Coopératif';
    this.lobbyModeEl.textContent = 'Mode : ' + label;
    // Reflete le mode dans les boutons (utile pour le host).
    this.modeCoop.classList.toggle('active', this.selectedMode === MODE.COOP);
    this.modePvp.classList.toggle('active', this.selectedMode === MODE.PVP);
  }

  _renderPlayers() {
    this.lobbyPlayers.innerHTML = '';
    for (const p of this.players) {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'lp-dot';
      dot.style.background = p.color;
      const name = document.createElement('span');
      name.className = 'lp-name';
      name.textContent = p.name + (p.id === this.selfId ? ' (toi)' : '');
      const tag = document.createElement('span');
      if (p.isHost) { tag.className = 'lp-host'; tag.textContent = 'HÔTE'; }
      else { tag.className = 'lp-ready ' + (p.ready ? 'yes' : 'no'); tag.textContent = p.ready ? 'Prêt' : 'En attente'; }
      li.append(dot, name, tag);
      this.lobbyPlayers.appendChild(li);
    }

    // Boutons selon role.
    const others = this.players.filter((p) => !p.isHost);
    const allReady = others.length > 0 && others.every((p) => p.ready);
    this.btnStart.style.display = this.isHost ? '' : 'none';
    this.btnReady.style.display = this.isHost ? 'none' : '';
    if (this.isHost) {
      this.btnStart.disabled = !(this.players.length >= 2 && allReady);
      this.lobbyHint.textContent = this.players.length < 2
        ? 'En attente d\'autres joueurs… (partage le code)'
        : (allReady ? 'Tout le monde est prêt — tu peux démarrer.' : 'En attente que tous soient prêts.');
    } else {
      this.lobbyHint.textContent = 'En attente que l\'hôte démarre la partie.';
    }
  }

  _toggleReady() {
    this._readyState = !this._readyState;
    this.net?.setReady(this._readyState);
    this.btnReady.classList.toggle('is-ready', this._readyState);
    this.btnReady.textContent = this._readyState ? 'PAS PRÊT' : 'PRÊT';
  }

  _leave() {
    try { this.net?.leave(); } catch { /* noop */ }
    this.net?.close();
    this.net = null;
    this.selfId = null;
    this.isHost = false;
    this._back();
  }

  _back() {
    this._hideAll();
    if (this.net && !this.started) { this.net.close(); this.net = null; }
    if (this.onBack) this.onBack();
  }
}
