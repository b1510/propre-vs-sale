import * as THREE from 'three';
import { PLAYER_EYE } from '../level/LevelData.js';

// Avatar d'un joueur distant : corps + tete + arme tenue + etiquette pseudo
// + barre de vie. Le transform recu (x,z,yaw) est interpole pour un rendu fluide
// malgre la frequence reseau (~20 Hz).

const LERP = 12; // vitesse de rattrapage de l'interpolation

function makeLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 34px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color || '#ffffff';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

export default class RemotePlayer {
  constructor({ id, name, color }) {
    this.id = id;
    this.name = name || 'Joueur';
    this.colorHex = color || '#4fc3f7';
    this.color = new THREE.Color(this.colorHex);

    this.hp = 100;
    this.maxHp = 100;
    this.dead = false;

    // Cibles d'interpolation (mises a jour par setState).
    this.target = new THREE.Vector3(0, 0, 0);
    this.targetYaw = 0;
    this._swing = 0;

    this.group = new THREE.Group();
    this._build();
    this._materials = [];
    this.group.traverse((o) => { if (o.isMesh) this._materials.push(o.material); });
  }

  _build() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.7, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c9a5, roughness: 0.8 });

    // Corps (tronc).
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), bodyMat);
    body.position.y = 0.95;
    this.group.add(body);
    this._body = body;

    // Tete.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), skinMat);
    head.position.y = 1.6;
    this.group.add(head);
    this._head = head;

    // Bras tenant l'arme (pivot a l'epaule).
    const arm = new THREE.Group();
    arm.position.set(0.34, 1.15, 0);
    this.group.add(arm);
    this._arm = arm;

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), skinMat
    );
    forearm.position.set(0, -0.05, 0.25);
    forearm.rotation.x = Math.PI / 2;
    arm.add(forearm);

    // Plumeau / outil tenu (cone rose).
    const tool = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 8),
      new THREE.MeshStandardMaterial({ color: 0xff80ab, roughness: 0.9 })
    );
    tool.position.set(0, -0.05, 0.55);
    tool.rotation.x = Math.PI / 2;
    arm.add(tool);

    // Etiquette pseudo.
    this.label = makeLabel(this.name, this.colorHex);
    this.label.position.set(0, 2.15, 0);
    this.group.add(this.label);

    // Barre de vie (sprite simple a deux couches).
    this._hpBack = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x330000, depthTest: false, transparent: true,
    }));
    this._hpBack.scale.set(1.0, 0.12, 1);
    this._hpBack.position.set(0, 1.95, 0);
    this.group.add(this._hpBack);

    this._hpFill = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x4caf50, depthTest: false, transparent: true,
    }));
    this._hpFill.position.set(0, 1.95, 0.001);
    this.group.add(this._hpFill);
    this._setHpScale(1);
  }

  _setHpScale(frac) {
    const w = 1.0 * Math.max(0, Math.min(1, frac));
    this._hpFill.scale.set(w, 0.1, 1);
    // Aligne a gauche : decale d'autant que la largeur manquante / 2.
    this._hpFill.position.x = -(1.0 - w) / 2;
  }

  // Recoit un transform reseau { x, z, yaw, hp, dead }.
  setState(s) {
    if (typeof s.x === 'number') this.target.set(s.x, 0, s.z);
    if (typeof s.yaw === 'number') this.targetYaw = s.yaw;
    if (typeof s.hp === 'number') {
      this.hp = s.hp;
      this._setHpScale(this.maxHp ? this.hp / this.maxHp : 0);
    }
    if (typeof s.dead === 'boolean') this.setDead(s.dead);
  }

  setDead(dead) {
    if (this.dead === dead) return;
    this.dead = dead;
    this.group.visible = !dead;
  }

  // Position visée (centre du corps, à hauteur des yeux) pour le ciblage IA / PvP.
  aimPos() {
    return new THREE.Vector3(this.target.x, PLAYER_EYE, this.target.z);
  }

  // Declenche l'animation de coup (recue via evenement reseau).
  swing() { this._swing = 0.25; }

  update(delta) {
    const t = 1 - Math.exp(-LERP * delta); // lissage exponentiel
    this.group.position.lerp(this.target, t);

    // Interpolation d'angle (chemin le plus court).
    let dy = this.targetYaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * t;

    // Animation de coup : balaie le bras vers l'avant.
    if (this._swing > 0) {
      this._swing = Math.max(0, this._swing - delta);
      const k = Math.sin((1 - this._swing / 0.25) * Math.PI);
      this._arm.rotation.x = -k * 1.2;
    } else {
      this._arm.rotation.x = 0;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (m) { m.map?.dispose?.(); m.dispose?.(); }
      }
    });
  }
}
