import * as THREE from 'three';
import Enemy from './Enemy.js';

// Caca : sphère marron avec deux yeux blancs. Tire des projectiles "caca".
export default class Caca extends Enemy {
  constructor(x, z) {
    super({
      hp: 25,
      speed: 2,
      sightRange: 15,
      attackRange: 12,
      attackCooldown: 3.5,
      coinDrop: 8,
      projectileType: 'caca',
      radius: 0.45,
      x, z,
      bodyY: 0.5,
    });
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8B4513, roughness: 0.8, emissive: 0x000000, emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), bodyMat);
    body.castShadow = true;
    this.group.add(body);

    // Petite bosse façon crotte.
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), bodyMat);
    top.position.set(0, 0.32, 0);
    this.group.add(top);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const sx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
      eye.position.set(sx, 0.1, 0.34);
      this.group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), pupilMat);
      pupil.position.set(sx, 0.1, 0.41);
      this.group.add(pupil);
    }
  }

  _animate(delta, time) {
    // Léger rebond.
    this.group.position.y = 0.5 + Math.abs(Math.sin(time * 4)) * 0.06;
  }
}
