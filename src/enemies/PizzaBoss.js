import * as THREE from 'three';
import Enemy from './Enemy.js';

// Boss Part de pizza (niveau 3) : 180 HP. Le plus agressif des trois boss.
//  • tir simple : part de pizza (14 dmg, cd 2.0s)
//  • éventail   : 3 parts simultanées en cône (~6s de rechargement)
//  • mêlée      : 16 dmg, cd 1.3s si le joueur est à moins de 3.2u
const FAN_SPREAD = (22 * Math.PI) / 180; // écart angulaire de l'éventail

export default class PizzaBoss extends Enemy {
  constructor(x, z) {
    super({
      hp: 180,
      speed: 1.7,
      sightRange: 30,
      attackRange: 24,
      attackCooldown: 2.0,
      coinDrop: 150,
      projectileType: 'part_de_pizza',
      radius: 0.8,
      x, z,
      bodyY: 0.95,
    });
    this.isBoss = true;
    this._meleeCooldown = 0;
    this._fanCooldown = 4; // première salve après 4s
    this.meleeRange = 3.2;
    this.meleeDamage = 16;
  }

  _buildMesh() {
    // Part triangulaire DEBOUT : prisme à 3 côtés dont la face triangulaire est
    // dans le plan XY (épaisseur suivant Z), pointe en haut et croûte en bas.
    // thetaStart = PI place un sommet en -Z local, que la rotation X de +90°
    // envoie vers le haut ; les deux autres sommets forment le bord bas.
    const triGeo = (r, h) => new THREE.CylinderGeometry(r, r, h, 3, 1, false, Math.PI);

    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xF9C74F, roughness: 0.6 });
    const slice = new THREE.Mesh(triGeo(0.95, 0.16), cheeseMat);
    slice.rotation.x = Math.PI / 2;
    slice.castShadow = true;
    this.group.add(slice);

    // Pâte derrière (légèrement plus large, plus foncée).
    const dough = new THREE.Mesh(
      triGeo(1.0, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xD2A055, roughness: 0.85 })
    );
    dough.rotation.x = Math.PI / 2;
    dough.position.z = -0.13;
    this.group.add(dough);

    // Croûte : bourrelet horizontal sur le bord bas (les « pieds » de la part).
    const crustMat = new THREE.MeshStandardMaterial({ color: 0xC98A3E, roughness: 0.9 });
    const crust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 1.7, 10), crustMat
    );
    crust.rotation.z = Math.PI / 2;
    crust.position.set(0, -0.5, -0.02);
    crust.castShadow = true;
    this.group.add(crust);

    // Pepperonis plaqués sur la face avant (disques tournés vers le joueur).
    const pepMat = new THREE.MeshStandardMaterial({ color: 0xC62828, roughness: 0.65 });
    const peps = [[0, 0.55], [-0.3, -0.1], [0.3, -0.1], [-0.5, -0.32], [0.5, -0.32]];
    for (const [px, py] of peps) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10), pepMat);
      p.rotation.x = Math.PI / 2;
      p.position.set(px, py, 0.11);
      this.group.add(p);
    }

    // Olives.
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.5 });
    for (const [ox, oy] of [[0, -0.3], [-0.16, 0.32], [0.16, 0.32]]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), oliveMat);
      o.position.set(ox, oy, 0.12);
      this.group.add(o);
    }

    // Filaments de fromage fondu qui pendent sous la croûte.
    const stringMat = new THREE.MeshStandardMaterial({ color: 0xFFE082, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.015, 0.4, 6), stringMat
      );
      s.position.set(-0.25 + i * 0.25, -0.82, 0.02);
      this.group.add(s);
    }

    // Yeux + pupilles au centre de la face avant.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    for (const sx of [-0.24, 0.24]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
      eye.position.set(sx, 0.22, 0.13);
      this.group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), pupilMat);
      pupil.position.set(sx, 0.22, 0.22);
      this.group.add(pupil);
    }

    // 2 mains (cubes) qui balancent.
    const handMat = new THREE.MeshStandardMaterial({ color: 0xD2A055, roughness: 0.7 });
    this._hands = [];
    for (const sx of [-1.05, 1.05]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), handMat);
      hand.position.set(sx, -0.1, 0.2);
      this.group.add(hand);
      this._hands.push(hand);
    }
  }

  _animate(delta, time) {
    this.group.position.y = 0.95 + Math.sin(time * 2) * 0.06;
    this.group.rotation.z = Math.sin(time * 1.5) * 0.08;
    if (this._hands) {
      this._hands[0].position.y = -0.1 + Math.sin(time * 4) * 0.14;
      this._hands[1].position.y = -0.1 + Math.sin(time * 4 + Math.PI) * 0.14;
    }
  }

  // Surcharge : mêlée + tir simple + salve en éventail de 3 parts.
  _onAttack(delta, dx, dz, dist, playerPos, level, actions) {
    if (this._meleeCooldown > 0) this._meleeCooldown -= delta;
    if (this._fanCooldown > 0) this._fanCooldown -= delta;

    const myPos = this.group.position;
    const los = level.hasLineOfSight(myPos.x, myPos.z, playerPos.x, playerPos.z);

    if (dist <= this.meleeRange && los) {
      this._moveToward(dx, dz, dist, delta, level);
      if (this._meleeCooldown <= 0) {
        this._meleeCooldown = 1.3;
        this._swing();
        actions.push({ type: 'melee', damage: this.meleeDamage });
      }
    } else if (los) {
      const origin = myPos.clone();
      origin.y = myPos.y + 0.1;

      if (this._fanCooldown <= 0) {
        // Éventail : 3 parts tirées en cône autour de la direction du joueur.
        this._fanCooldown = 6;
        this._cooldownTimer = this.attackCooldown; // pas de tir simple dans la foulée
        for (const a of [-FAN_SPREAD, 0, FAN_SPREAD]) {
          const cos = Math.cos(a), sin = Math.sin(a);
          const rx = dx * cos - dz * sin;
          const rz = dx * sin + dz * cos;
          actions.push({
            type: 'shoot',
            projType: 'part_de_pizza',
            origin: origin.clone(),
            target: new THREE.Vector3(myPos.x + rx, playerPos.y, myPos.z + rz),
          });
        }
      } else if (this._cooldownTimer <= 0) {
        this._cooldownTimer = this.attackCooldown;
        actions.push({
          type: 'shoot', projType: 'part_de_pizza', origin, target: playerPos.clone(),
        });
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
