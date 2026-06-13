import * as THREE from 'three';

// Système de particules léger : petites sphères éjectées avec gravité, qui
// rétrécissent puis disparaissent. Géométrie partagée + matériaux mis en cache
// par couleur pour rester économe.

export default class Particles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.08, 6, 6);
    this.mats = {}; // color -> material
  }

  setScene(scene) {
    this.clear();
    this.scene = scene;
  }

  _mat(color) {
    if (!this.mats[color]) {
      this.mats[color] = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.25, roughness: 0.7,
      });
    }
    return this.mats[color];
  }

  // Émet `count` particules depuis `pos` (THREE.Vector3).
  burst(pos, color, count = 10, opts = {}) {
    const spd = opts.speed ?? 3;
    const up = opts.up ?? 2.4;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 1;
    const grav = opts.gravity ?? 7;
    const mat = this._mat(color);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(pos);
      m.scale.setScalar(size * (0.5 + Math.random() * 0.7));
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      const vel = new THREE.Vector3(
        Math.cos(a) * spd * r,
        up * (0.4 + Math.random() * 0.8),
        Math.sin(a) * spd * r
      );
      this.scene.add(m);
      this.list.push({ m, vel, life, grav });
    }
  }

  update(delta) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.vel.y -= p.grav * delta;
      p.m.position.addScaledVector(p.vel, delta);
      p.m.scale.multiplyScalar(0.92);
      p.life -= delta;
      if (p.life <= 0 || p.m.scale.x < 0.01) {
        this.scene.remove(p.m);
        this.list.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.m);
    this.list = [];
  }
}
