import * as THREE from 'three';
import Enemy from './Enemy.js';

// Poussière : sphère grise semi-transparente avec particules flottantes.
export default class Poussiere extends Enemy {
  constructor(x, z) {
    super({
      hp: 25,
      speed: 1.8,
      sightRange: 15,
      attackRange: 14,
      attackCooldown: 3.0,
      coinDrop: 6,
      projectileType: 'poussiere',
      radius: 0.5,
      x, z,
      bodyY: 0.55,
    });
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xAAAAAA, roughness: 1.0, transparent: true, opacity: 0.8,
      emissive: 0x000000, emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), bodyMat);
    this.group.add(body);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const sx of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(sx, 0.08, 0.4);
      this.group.add(eye);
    }

    // Particules de poussière flottantes.
    this._particles = [];
    const partMat = new THREE.MeshStandardMaterial({
      color: 0xC0C0C0, transparent: true, opacity: 0.6,
    });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), partMat);
      const ang = (i / 4) * Math.PI * 2;
      p.userData.ang = ang;
      p.userData.rad = 0.55 + Math.random() * 0.15;
      this.group.add(p);
      this._particles.push(p);
    }
  }

  _animate(delta, time) {
    this.group.position.y = 0.55 + Math.sin(time * 2) * 0.08;
    for (const p of this._particles) {
      p.userData.ang += delta * 1.5;
      const r = p.userData.rad;
      p.position.set(
        Math.cos(p.userData.ang) * r,
        Math.sin(time * 3 + p.userData.ang) * 0.2,
        Math.sin(p.userData.ang) * r
      );
    }
  }
}
