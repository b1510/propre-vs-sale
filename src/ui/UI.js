import { getMapBounds } from '../level/LevelData.js';

// HUD : vie, compteur de pièces, nom de pièce, barre boss, flash dégâts,
// message flottant, minimap top-down.

export default class UI {
  constructor() {
    this.healthFill = document.getElementById('healthFill');
    this.coinCounter = document.getElementById('coinCounter');
    this.roomName = document.getElementById('roomName');
    this.crosshair = document.getElementById('crosshair');
    this.cleanHud = document.getElementById('cleanHud');
    this.damageFlash = document.getElementById('damageFlash');
    this.bossBar = document.getElementById('bossBar');
    this.bossFill = document.getElementById('bossFill');
    this.bossLabel = document.getElementById('bossLabel');
    this.floatMsg = document.getElementById('floatMsg');
    this.inventoryHud = document.getElementById('inventoryHud');
    this.boostHud = document.getElementById('boostHud');
    this.scoreboard = document.getElementById('scoreboard');

    this.minimap = document.getElementById('minimap');
    this.mmCtx = this.minimap.getContext('2d');

    // Données du niveau courant (renseignées par setLevel).
    this.rooms = {};
    this.keyPosition = { x: 0, y: 0, z: 0 };
    this.bossRoom = null;

    this._roomNameTimer = 0;
    this._flashTimer = 0;
    this._floatTimer = 0;
  }

  // Configure la minimap et le HUD pour le niveau donné.
  setLevel(config) {
    this.rooms = config.rooms;
    this.keyPosition = config.keyPosition;
    this.bossRoom = config.bossRoom;
    this.bounds = getMapBounds(config.rooms);
    this._computeMinimapTransform();
    if (this.bossLabel && config.bossLabel) {
      this.bossLabel.textContent = config.bossLabel;
    }
  }

  _computeMinimapTransform() {
    const b = this.bounds;
    const mapW = b.maxX - b.minX;
    const mapH = b.maxZ - b.minZ;
    const pad = 8;
    const size = 150 - pad * 2;
    this._mmScale = Math.min(size / mapW, size / mapH);
    // Centrage.
    this._mmOffsetX = pad + (size - mapW * this._mmScale) / 2;
    this._mmOffsetY = pad + (size - mapH * this._mmScale) / 2;
  }

  _toMM(x, z) {
    return {
      px: this._mmOffsetX + (x - this.bounds.minX) * this._mmScale,
      py: this._mmOffsetY + (z - this.bounds.minZ) * this._mmScale,
    };
  }

  setHealth(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.healthFill.style.width = pct + '%';
  }

  setCoins(n) {
    this.coinCounter.textContent = `🪙 ${n}`;
  }

  showRoomName(label) {
    this.roomName.textContent = label;
    this.roomName.style.opacity = '1';
    this._roomNameTimer = 2.5;
  }

  flashDamage() {
    this.damageFlash.style.opacity = '1';
    this._flashTimer = 0.25;
  }

  // Marqueur de coup (réticule) quand on touche un ennemi/une tache.
  flashCrosshair() {
    this.crosshair.classList.add('hit');
    clearTimeout(this._chTimer);
    this._chTimer = setTimeout(() => this.crosshair.classList.remove('hit'), 110);
  }

  // Chiffre de dégât flottant à la position monde projetée.
  showDamageNumber(worldPos, amount, camera, crit = false) {
    const v = worldPos.clone().project(camera);
    if (v.z > 1) return; // derrière la caméra
    const el = document.createElement('div');
    el.className = 'dmgNum' + (crit ? ' crit' : '');
    el.textContent = Math.round(amount);
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // Jauge de propreté de la pièce courante.
  setCleanliness(cleaned, total) {
    if (!total) { this.cleanHud.style.display = 'none'; return; }
    this.cleanHud.style.display = 'block';
    const pct = Math.round((cleaned / total) * 100);
    this.cleanHud.textContent = `🧽 ${cleaned}/${total} (${pct}%)`;
  }

  showMessage(text, duration = 2.5) {
    this.floatMsg.textContent = text;
    this.floatMsg.style.opacity = '1';
    this._floatTimer = duration;
  }

  setBossVisible(v) {
    this.bossBar.style.display = v ? 'block' : 'none';
  }

  // Affiche les consommables possédés (inventaire de boutique).
  setInventory(inv) {
    const lines = [];
    if (inv.heal > 0) lines.push(`[1] Soin ×${inv.heal}`);
    if (inv.damage > 0) lines.push(`[2] Boost dégâts ×${inv.damage}`);
    if (lines.length === 0) {
      this.inventoryHud.innerHTML = '<span class="empty">Inventaire vide</span>';
    } else {
      this.inventoryHud.innerHTML = lines.join('<br>');
    }
  }

  // Indicateur du boost de dégâts actif (secondes restantes).
  setBoost(secondsRemaining) {
    if (secondsRemaining > 0) {
      this.boostHud.style.display = 'block';
      this.boostHud.textContent = `⚡ Boost dégâts : ${secondsRemaining.toFixed(0)} s`;
    } else {
      this.boostHud.style.display = 'none';
    }
  }

  setBossHealth(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.bossFill.style.width = pct + '%';
  }

  // --- Tableau des scores (multijoueur) ---
  setScoreboardVisible(v) {
    if (this.scoreboard) this.scoreboard.style.display = v ? 'block' : 'none';
  }

  // rows : [{ name, color, value, me, dead }]
  setScoreboard(title, rows) {
    if (!this.scoreboard) return;
    let html = `<div class="sb-title">${this._escape(title)}</div>`;
    for (const r of rows) {
      html +=
        `<div class="sb-row${r.dead ? ' dead' : ''}">` +
        `<span class="sb-dot" style="background:${this._escape(r.color)}"></span>` +
        `<span class="sb-name${r.me ? ' me' : ''}">${this._escape(r.name)}</span>` +
        `<span class="sb-val">${this._escape(r.value)}</span>` +
        `</div>`;
    }
    this.scoreboard.innerHTML = html;
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  update(delta) {
    if (this._roomNameTimer > 0) {
      this._roomNameTimer -= delta;
      if (this._roomNameTimer <= 0) this.roomName.style.opacity = '0';
    }
    if (this._flashTimer > 0) {
      this._flashTimer -= delta;
      if (this._flashTimer <= 0) this.damageFlash.style.opacity = '0';
    }
    if (this._floatTimer > 0) {
      this._floatTimer -= delta;
      if (this._floatTimer <= 0) this.floatMsg.style.opacity = '0';
    }
  }

  // Dessine la minimap top-down.
  drawMinimap(playerPos, visitedRooms, keyCollected) {
    const ctx = this.mmCtx;
    ctx.clearRect(0, 0, 150, 150);

    // Pièces.
    for (const name in this.rooms) {
      const r = this.rooms[name];
      const a = this._toMM(r.minX, r.minZ);
      const b = this._toMM(r.maxX, r.maxZ);
      const w = b.px - a.px;
      const h = b.py - a.py;

      if (name === this.bossRoom) {
        ctx.fillStyle = visitedRooms.has(name) ? '#5a2a2a' : '#2a1414';
      } else {
        ctx.fillStyle = visitedRooms.has(name) ? '#9aa0a6' : '#3a3d42';
      }
      ctx.fillRect(a.px, a.py, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(a.px, a.py, w, h);
    }

    // Clé (si non ramassée).
    if (!keyCollected) {
      const k = this._toMM(this.keyPosition.x, this.keyPosition.z);
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath();
      ctx.arc(k.px, k.py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Joueur (point rouge avec direction).
    const p = this._toMM(playerPos.x, playerPos.z);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(p.px, p.py, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
