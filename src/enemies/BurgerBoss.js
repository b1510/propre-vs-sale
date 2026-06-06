import * as THREE from 'three';
import Enemy, { STATE } from './Enemy.js';

// Boss Burger (niveau 2) : 130 HP. Lance des boules de feu (11 dmg, cd 2.2s)
// et frappe au corps-à-corps (13 dmg, cd 1.5s) si le joueur est à moins de 3u.
// Inflige 1 dégât de plus que le boss Tacos sur ses deux attaques.

export default class BurgerBoss extends Enemy {
  constructor(x, z) {
    super({
      hp: 130,
      speed: 1.6,
      sightRange: 30,
      attackRange: 22,
      attackCooldown: 2.2,
      coinDrop: 120,
      projectileType: 'boule_de_feu',
      radius: 0.75,
      x, z,
      bodyY: 0.9,
    });
    this.isBoss = true;
    this._meleeCooldown = 0;
    this.meleeRange = 3;
    this.meleeDamage = 13;
  }

  _buildMesh() {
    // Pain du bas.
    const bunMat = new THREE.MeshStandardMaterial({ color: 0xC8842A, roughness: 0.7 });
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.55, 0.3, 12), bunMat
    );
    bottom.position.y = -0.45;
    bottom.castShadow = true;
    this.group.add(bottom);

    // Steak.
    const patty = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.66, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.85 })
    );
    patty.position.y = -0.22;
    this.group.add(patty);

    // Fromage (carré fondant orange).
    const cheese = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.08, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.5 })
    );
    cheese.position.y = -0.08;
    cheese.rotation.y = Math.PI / 4;
    this.group.add(cheese);

    // Salade (anneau vert).
    const lettuce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9 })
    );
    lettuce.position.y = 0.02;
    this.group.add(lettuce);

    // Tomate (disque rouge).
    const tomato = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.7 })
    );
    tomato.position.y = 0.12;
    this.group.add(tomato);

    // Pain du haut (dôme).
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      bunMat
    );
    top.position.y = 0.18;
    top.scale.y = 0.85;
    top.castShadow = true;
    this.group.add(top);

    // Graines de sésame.
    const seedMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, roughness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), seedMat);
      const a = (i / 8) * Math.PI * 2;
      const r = 0.28 + (i % 2) * 0.14;
      seed.position.set(Math.cos(a) * r, 0.32 + Math.sin(a * 2) * 0.04, Math.sin(a) * r);
      this.group.add(seed);
    }

    // Yeux (sur le pain du haut).
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    for (const sx of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat);
      eye.position.set(sx, 0.22, 0.5);
      this.group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), pupilMat);
      pupil.position.set(sx, 0.22, 0.61);
      this.group.add(pupil);
    }

    // 2 mains (cubes) qui balancent.
    const handMat = new THREE.MeshStandardMaterial({ color: 0xC8842A, roughness: 0.7 });
    this._hands = [];
    for (const sx of [-0.95, 0.95]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), handMat);
      hand.position.set(sx, -0.2, 0.2);
      this.group.add(hand);
      this._hands.push(hand);
    }
  }

  _animate(delta, time) {
    this.group.position.y = 0.9 + Math.sin(time * 2) * 0.05;
    if (this._hands) {
      this._hands[0].position.y = -0.2 + Math.sin(time * 4) * 0.12;
      this._hands[1].position.y = -0.2 + Math.sin(time * 4 + Math.PI) * 0.12;
    }
  }

  // Surcharge : gère mêlée + tir de boules de feu longue portée.
  _onAttack(delta, dx, dz, dist, playerPos, level, actions) {
    if (this._meleeCooldown > 0) this._meleeCooldown -= delta;

    const myPos = this.group.position;
    const los = level.hasLineOfSight(myPos.x, myPos.z, playerPos.x, playerPos.z);

    if (dist <= this.meleeRange && los) {
      this._moveToward(dx, dz, dist, delta, level);
      if (this._meleeCooldown <= 0) {
        this._meleeCooldown = 1.5;
        this._swing();
        actions.push({ type: 'melee', damage: this.meleeDamage });
      }
    } else if (los) {
      // Boule de feu longue portée (seulement si ligne de vue libre).
      if (this._cooldownTimer <= 0) {
        this._cooldownTimer = this.attackCooldown;
        const origin = myPos.clone();
        origin.y = myPos.y + 0.1;
        actions.push({ type: 'shoot', projType: 'boule_de_feu', origin, target: playerPos.clone() });
      }
      this._moveToward(dx, dz, dist, delta, level);
    } else {
      // Pas de ligne de vue → avance vers le joueur sans tirer.
      this._moveToward(dx, dz, dist, delta, level);
    }
  }

  _swing() {
    if (!this._hands) return;
    const h = this._hands[0];
    h.position.z = 0.6;
    setTimeout(() => { if (h) h.position.z = 0.2; }, 180);
  }
}
