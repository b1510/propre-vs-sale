import * as THREE from 'three';

// Mécanique « Propre vs Sale » : des taches au sol que le joueur nettoie avec
// son arme (aspirateur/plumeau). Chaque pièce a un total de taches ; la jauge
// de propreté monte au fur et à mesure, avec récompense quand la pièce est nette.

let _stainTex = null;
function stainTexture() {
  if (_stainTex) return _stainTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  // Tache irrégulière : plusieurs disques flous superposés.
  for (let i = 0; i < 14; i++) {
    const px = 64 + (Math.random() * 2 - 1) * 34;
    const py = 64 + (Math.random() * 2 - 1) * 34;
    const r = 12 + Math.random() * 26;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  _stainTex = new THREE.CanvasTexture(c);
  return _stainTex;
}

export default class Stains {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.tex = stainTexture();
    this.roomTotals = {};
    this.roomCleaned = {};
    this._nextId = 0;
  }

  // Crée des taches dans chaque pièce de la config (sauf exclusions).
  // `rng` : fonction 0..1 (Math.random par défaut). En multijoueur on passe un
  // RNG seedé partagé pour que tous les clients obtiennent la même disposition.
  build(config, perRoom = 5, rng = Math.random) {
    const rooms = config.rooms;
    for (const name in rooms) {
      const d = rooms[name];
      const count = perRoom;
      this.roomTotals[name] = count;
      this.roomCleaned[name] = 0;
      for (let i = 0; i < count; i++) {
        const margin = 1.6;
        const px = d.minX + margin + rng() * (d.maxX - d.minX - margin * 2);
        const pz = d.minZ + margin + rng() * (d.maxZ - d.minZ - margin * 2);
        this._spawn(px, pz, name, rng);
      }
    }
  }

  _spawn(x, z, room, rng = Math.random) {
    const colors = [0x4a3526, 0x3a2a1a, 0x5a4a2a, 0x2e3a2a];
    const mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, opacity: 0.85, depthWrite: false,
      color: colors[(rng() * colors.length) | 0],
    });
    const m = new THREE.Mesh(this.geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rng() * Math.PI * 2;
    m.position.set(x, 0.04, z);
    const base = 0.8 + rng() * 0.8;
    m.scale.setScalar(base);
    this.scene.add(m);
    this.list.push({ id: this._nextId++, m, mat, room, progress: 1, base });
  }

  // Retire instantanément une tache par id (réconciliation réseau : une tache
  // nettoyée par un autre joueur). Idempotent. Met à jour le compteur de pièce.
  // Retourne { room, completedRoom, position } ou null si déjà absente.
  removeById(id) {
    const i = this.list.findIndex((s) => s.id === id);
    if (i === -1) return null;
    const s = this.list[i];
    const position = s.m.position.clone();
    this.scene.remove(s.m);
    s.mat.dispose();
    this.list.splice(i, 1);
    this.roomCleaned[s.room] = (this.roomCleaned[s.room] || 0) + 1;
    const completedRoom =
      this.roomCleaned[s.room] === this.roomTotals[s.room] ? s.room : null;
    return { room: s.room, completedRoom, position };
  }

  cleanliness(room) {
    const tot = this.roomTotals[room];
    if (!tot) return null;
    return this.roomCleaned[room] / tot;
  }

  // Nettoie les taches devant le joueur. Retourne { worked, removed:[{position,room,completedRoom}] }.
  cleanNear(pos, forward, range, amount = 0.5) {
    let worked = false;
    const removed = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      const dx = s.m.position.x - pos.x;
      const dz = s.m.position.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      // Cône orienté vers le regard (large), ou tache quasi sous le joueur.
      if (dist > 0.6) {
        const inv = 1 / (dist || 1);
        if (dx * inv * forward.x + dz * inv * forward.z < 0.25) continue;
      }
      s.progress -= amount;
      worked = true;
      if (s.progress <= 0) {
        const position = s.m.position.clone();
        this.scene.remove(s.m);
        s.mat.dispose();
        this.list.splice(i, 1);
        this.roomCleaned[s.room] = (this.roomCleaned[s.room] || 0) + 1;
        const completedRoom =
          this.roomCleaned[s.room] === this.roomTotals[s.room] ? s.room : null;
        removed.push({ id: s.id, position, room: s.room, completedRoom });
      } else {
        s.m.scale.setScalar(s.base * (0.35 + 0.65 * s.progress));
        s.mat.opacity = 0.25 + 0.6 * s.progress;
      }
    }
    return { worked, removed };
  }

  dispose() {
    for (const s of this.list) { this.scene.remove(s.m); s.mat.dispose(); }
    this.list = [];
    this.geo.dispose();
  }
}
