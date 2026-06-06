import * as THREE from 'three';
import Enemy, { STATE } from './Enemy.js';

// Boss Tacos : 80 HP. Attaque longue portée (viande, 15 dmg, cd 1.5s)
// et attaque mêlée (baffe, 20 dmg, cd 1s) si le joueur est à moins de 3u.

export default class TacosBoss extends Enemy {
  constructor(x, z) {
    super({
      hp: 80,
      speed: 1.5,
      sightRange: 30,
      attackRange: 22,
      attackCooldown: 2.5,
      coinDrop: 100,
      projectileType: 'viande',
      radius: 0.7,
      x, z,
      bodyY: 0.9,
    });
    this.isBoss = true;
    this._meleeCooldown = 0;
    this.meleeRange = 3;
    this.meleeDamage = 12;
  }

  _buildMesh() {
    // Corps (coque tacos).
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xD2691E, roughness: 0.7,
        emissive: 0x000000, emissiveIntensity: 0 })
    );
    body.position.y = 0;
    body.castShadow = true;
    this.group.add(body);

    // Laitue (garniture verte sur le dessus).
    const lettuce = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9 })
    );
    lettuce.position.y = 0.75;
    this.group.add(lettuce);

    // Viande.
    const meat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.8 })
    );
    meat.position.y = 0.95;
    this.group.add(meat);

    // Yeux.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    for (const sx of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat);
      eye.position.set(sx, 0.2, 0.55);
      this.group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), pupilMat);
      pupil.position.set(sx, 0.2, 0.66);
      this.group.add(pupil);
    }

    // 2 mains (cubes).
    const handMat = new THREE.MeshStandardMaterial({ color: 0xD2691E, roughness: 0.7 });
    this._hands = [];
    for (const sx of [-0.85, 0.85]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), handMat);
      hand.position.set(sx, 0.05, 0.2);
      this.group.add(hand);
      this._hands.push(hand);
    }
  }

  _animate(delta, time) {
    this.group.position.y = 0.9 + Math.sin(time * 2) * 0.05;
    // Mains qui balancent.
    if (this._hands) {
      this._hands[0].position.y = 0.05 + Math.sin(time * 4) * 0.12;
      this._hands[1].position.y = 0.05 + Math.sin(time * 4 + Math.PI) * 0.12;
    }
  }

  // Surcharge : gère mêlée + tir longue portée.
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
      // Tir de viande longue portée (seulement si ligne de vue libre).
      if (this._cooldownTimer <= 0) {
        this._cooldownTimer = this.attackCooldown;
        const origin = myPos.clone();
        origin.y = myPos.y + 0.95;
        actions.push({ type: 'shoot', projType: 'viande', origin, target: playerPos.clone() });
      }
      this._moveToward(dx, dz, dist, delta, level);
    } else {
      // Pas de ligne de vue → le boss avance vers le joueur sans tirer.
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
