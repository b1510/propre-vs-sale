import * as THREE from 'three';
import Enemy from './Enemy.js';

// Microbe (niveau 3) : le plus rapide et le plus fragile. Fonce au contact et
// crache des spores faibles (4 dmg) mais à cadence rapide (cd 1.2s).
export default class Microbe extends Enemy {
  constructor(x, z) {
    super({
      hp: 18,
      speed: 3.0,
      sightRange: 16,
      attackRange: 10,
      attackCooldown: 1.2,
      coinDrop: 7,
      projectileType: 'spore',
      radius: 0.38,
      x, z,
      bodyY: 0.5,
    });
  }

  _buildMesh() {
    // Membrane verte translucide (emissive requis pour le flash de dégât).
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8BC34A, roughness: 0.55, transparent: true, opacity: 0.85,
      emissive: 0x000000, emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), bodyMat);
    this.group.add(body);

    // Noyau interne visible à travers la membrane.
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x33691E, roughness: 0.8 })
    );
    nucleus.position.set(0, -0.02, -0.04);
    this.group.add(nucleus);

    // Pseudopodes (bosses en surface).
    const podMat = new THREE.MeshStandardMaterial({ color: 0x9CCC65, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), podMat);
      pod.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.12, Math.sin(a) * 0.26);
      this.group.add(pod);
    }

    // Flagelles à l'arrière (ondulent dans _animate).
    this._flagella = [];
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x689F38, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.01, 0.5, 5), flagMat
      );
      const a = (i / 5) * Math.PI * 2;
      // Rattaché à l'arrière (-Z), en éventail.
      f.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.5);
      f.rotation.x = Math.PI / 2;
      f.userData.phase = a;
      this.group.add(f);
      this._flagella.push(f);
    }

    // Yeux.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
    for (const sx of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
      eye.position.set(sx, 0.08, 0.3);
      this.group.add(eye);
    }
  }

  _animate(delta, time) {
    this.group.position.y = 0.5 + Math.sin(time * 3) * 0.1;
    // Pulsation de la membrane.
    const s = 1 + Math.sin(time * 6) * 0.06;
    this.group.scale.setScalar(s);
    for (const f of this._flagella) {
      f.rotation.z = Math.sin(time * 10 + f.userData.phase) * 0.4;
    }
  }
}
