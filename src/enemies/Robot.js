import * as THREE from 'three';
import Enemy from './Enemy.js';

// Robot de la chaîne de construction (niveau 4) : cible passive. Il ne bouge
// pas, n'attaque jamais, mais peut être détruit contre quelques pièces.

const PALETTES = [0x90A4AE, 0x78909C, 0xB0BEC5, 0xA1887F, 0x80CBC4];

export default class Robot extends Enemy {
  constructor(x, z) {
    super({
      hp: 60,
      speed: 0,
      sightRange: 0,
      attackRange: 0,
      attackCooldown: 1,
      coinDrop: 4,
      projectileType: null,
      radius: 0.5,
      x, z,
      bodyY: 1.12, // posé sur le tapis roulant (dessus à y≈0.56)
    });
    this.isStatic = true;
    this._seed = Math.random() * 6.28;
    // Fait face à l'allée centrale de la chaîne.
    this.group.rotation.y = z < -30 ? 0 : Math.PI;
  }

  _buildMesh() {
    const body = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const metal = new THREE.MeshStandardMaterial({ color: body, roughness: 0.4, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.5 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff8f00, roughness: 0.5, metalness: 0.3 });

    // Jambes.
    for (const sx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.16), dark);
      leg.position.set(sx, -0.38, 0);
      this.group.add(leg);
    }
    // Torse + plastron.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.34), metal);
    torso.position.y = 0;
    this.group.add(torso);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.04), accent);
    plate.position.set(0, 0.04, 0.19);
    this.group.add(plate);

    // Tête + visière lumineuse (MeshBasic : ne clignote pas rouge au flash).
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.28), metal);
    head.position.y = 0.42;
    this.group.add(head);
    this._head = head;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.07, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7 })
    );
    visor.position.set(0, 0.02, 0.15);
    head.add(visor);

    // Antenne.
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), dark);
    ant.position.set(0.08, 0.64, 0);
    this.group.add(ant);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5252 })
    );
    bulb.position.set(0.08, 0.75, 0);
    this.group.add(bulb);

    // Bras articulés (balancent comme s'ils assemblaient une pièce).
    this._arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.34, 0.2, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), dark);
      arm.position.y = -0.2;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), accent);
      hand.position.y = -0.43;
      pivot.add(arm, hand);
      this.group.add(pivot);
      this._arms.push(pivot);
    }
  }

  _animate(delta, time) {
    const t = time * 2.4 + this._seed;
    this._arms[0].rotation.x = -0.5 + Math.sin(t) * 0.7;
    this._arms[1].rotation.x = -0.5 + Math.sin(t + Math.PI) * 0.7;
    this._head.rotation.y = Math.sin(time * 0.9 + this._seed) * 0.5;
  }

  // Passif : anime seulement, ne cible et ne tire jamais.
  update(delta) {
    if (this.dead) return [];
    this._animate(delta, performance.now() * 0.001);
    if (this._hitFlash > 0) {
      this._hitFlash -= delta;
      this._setEmissive(this._hitFlash > 0 ? 0.6 : 0);
    }
    return [];
  }
}
