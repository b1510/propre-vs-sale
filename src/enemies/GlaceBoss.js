import * as THREE from 'three';
import Enemy from './Enemy.js';

// Boss Glace à l'italienne (niveau 4) : deux barres de vie enchaînées.
//  • Phase 1 (140 PV) : rapide, boules de glace qui font peu de dégâts.
//  • À 0 PV la glace FOND : transformation (invulnérable ~1.4 s) puis phase 2.
//  • Phase 2 (170 PV) : plus lent mais ses boules fondues font beaucoup plus
//    de dégâts, avec une salve en éventail toutes les 5 s.
const PHASE1_HP = 140;
const PHASE2_HP = 170;
const TRANSITION_TIME = 1.4;
const FAN_SPREAD = (20 * Math.PI) / 180;

export default class GlaceBoss extends Enemy {
  constructor(x, z) {
    super({
      hp: PHASE1_HP,
      speed: 3.8,            // rapide : plus que la marche du joueur
      sightRange: 34,
      attackRange: 26,
      attackCooldown: 1.5,
      coinDrop: 200,
      projectileType: 'glace',
      radius: 0.85,
      x, z,
      bodyY: 1.25,
    });
    this.isBoss = true;
    this.phase = 1;
    this.phaseChanged = false; // consommé par Game pour les effets
    this._transition = 0;
    this._melt = 0;            // 0 = glace intacte, 1 = fondue (animé)
    this._meltTarget = 0;
    this._meleeCooldown = 0;
    this._fanCooldown = 5;
    this.meleeRange = 3.0;
    this.meleeDamage = 8;
  }

  _buildMesh() {
    this._creamMats = [];
    const cream = (color) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
      this._creamMats.push({ mat: m, base: new THREE.Color(color) });
      return m;
    };

    // Cornet gaufré (pointe vers le bas).
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0xD9A441, roughness: 0.85 })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = -0.82;
    this.group.add(cone);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.06, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xB9822B, roughness: 0.85 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.38;
    this.group.add(rim);

    // Tourbillon de glace : anneaux de crème empilés (s'affaissent en fondant).
    this._swirl = new THREE.Group();
    const rings = [
      [-0.05, 0.62, 0xFFF3E0], [0.28, 0.52, 0xFFE9F0],
      [0.58, 0.40, 0xFFF3E0], [0.84, 0.27, 0xFFE9F0],
    ];
    rings.forEach(([y, r, col], i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cream(col));
      s.scale.y = 0.62;
      s.position.set(i % 2 ? 0.04 : -0.04, y, 0);
      this._swirl.add(s);
    });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 10), cream(0xFFF3E0));
    tip.position.y = 1.1;
    this._swirl.add(tip);
    const cherry = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xC62828, roughness: 0.3 })
    );
    cherry.position.y = 1.32;
    this._swirl.add(cherry);
    this.group.add(this._swirl);

    // Visage sur le 2e anneau (face avant = +Z).
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    this._eyes = [];
    for (const sx of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), eyeMat);
      eye.position.set(sx, 0.34, 0.44);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
      pupil.position.set(0, 0, 0.1);
      eye.add(pupil);
      this.group.add(eye);
      this._eyes.push(eye);
    }
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.03, 6, 14, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x5d2a2a })
    );
    mouth.rotation.z = Math.PI; // sourire
    mouth.position.set(0, 0.12, 0.5);
    this.group.add(mouth);
    this._mouth = mouth;

    // Gouttes qui pendent (visibles en phase 2) + flaque au sol.
    this._drips = new THREE.Group();
    const dripMat = new THREE.MeshStandardMaterial({ color: 0xFFC1D6, roughness: 0.3 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const len = 0.35 + (i % 3) * 0.2;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, len, 6), dripMat);
      d.position.set(Math.cos(a) * 0.5, -0.3 - len / 2, Math.sin(a) * 0.5);
      this._drips.add(d);
    }
    this._drips.visible = false;
    this.group.add(this._drips);

    this._puddle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.03, 24),
      new THREE.MeshStandardMaterial({
        color: 0xFFB3CE, roughness: 0.15, transparent: true, opacity: 0.85,
      })
    );
    this._puddle.position.y = -1.23;
    this._puddle.visible = false;
    this.group.add(this._puddle);
  }

  // Passe en phase n (appelé aussi côté client non-host via le snapshot).
  setPhase(n) {
    if (n === this.phase) return;
    this.phase = n;
    this.phaseChanged = true;
    if (n === 2) {
      this.maxHp = PHASE2_HP;
      this.hp = PHASE2_HP;
      this.speed *= 0.7;
      this.attackCooldown = 1.0;
      this._cooldownTimer = 0.8;
      this.projectileType = 'glace_fondue';
      this.meleeDamage = 14;
      this._meltTarget = 1;
      this._drips.visible = true;
      this._puddle.visible = true;
    }
  }

  takeDamage(dmg) {
    if (this.dead || this._transition > 0) return; // invulnérable pendant la fonte
    if (this.phase === 1) {
      this.hp -= dmg;
      if (this.hp <= 0) {
        this.setPhase(2);
        this._transition = TRANSITION_TIME;
      } else {
        this._hitFlash = 0.12;
      }
      return;
    }
    super.takeDamage(dmg);
  }

  _animate(delta, time) {
    // Interpolation de la fonte.
    this._melt += (this._meltTarget - this._melt) * Math.min(1, delta * 2.5);
    const m = this._melt;
    const wobble = Math.sin(time * (this.phase === 1 ? 6 : 3)) * (this.phase === 1 ? 0.06 : 0.03);

    this.group.position.y = 1.25 - m * 0.18 + Math.abs(Math.sin(time * 5)) * (this.phase === 1 ? 0.08 : 0.02);
    this._swirl.scale.set(1 + 0.14 * m, 1 - 0.28 * m, 1 + 0.14 * m);
    this._swirl.position.y = -0.1 * m;
    this._swirl.rotation.z = wobble;
    this._swirl.rotation.x = wobble * 0.6;
    this._drips.scale.y = 0.4 + Math.sin(time * 2) * 0.12 + m * 0.6;
    this._puddle.scale.set(0.6 + m * 0.6, 1, 0.6 + m * 0.6);

    // Crème qui rosit en fondant.
    const melted = new THREE.Color(0xFFC9DC);
    for (const c of this._creamMats) c.mat.color.copy(c.base).lerp(melted, m * 0.7);

    // Bouche : sourire → grimace.
    this._mouth.rotation.z = Math.PI * (1 - m);
  }

  update(delta, playerPos, level) {
    if (this._transition > 0) {
      this._transition -= delta;
      this._animate(delta, performance.now() * 0.001);
      this._setEmissive(Math.sin(performance.now() * 0.03) > 0 ? 0.6 : 0);
      if (this._transition <= 0) this._setEmissive(0);
      return [];
    }
    return super.update(delta, playerPos, level);
  }

  _onAttack(delta, dx, dz, dist, playerPos, level, actions) {
    if (this._meleeCooldown > 0) this._meleeCooldown -= delta;
    if (this.phase === 2 && this._fanCooldown > 0) this._fanCooldown -= delta;

    const myPos = this.group.position;
    const los = level.hasLineOfSight(myPos.x, myPos.z, playerPos.x, playerPos.z);

    if (dist <= this.meleeRange && los) {
      this._moveToward(dx, dz, dist, delta, level);
      if (this._meleeCooldown <= 0) {
        this._meleeCooldown = 1.2;
        actions.push({ type: 'melee', damage: this.meleeDamage });
      }
      return;
    }
    if (los) {
      const origin = myPos.clone();
      origin.y = myPos.y + 0.3;
      if (this.phase === 2 && this._fanCooldown <= 0) {
        // Salve de 3 boules fondues en éventail.
        this._fanCooldown = 5;
        this._cooldownTimer = this.attackCooldown;
        for (const a of [-FAN_SPREAD, 0, FAN_SPREAD]) {
          const cos = Math.cos(a), sin = Math.sin(a);
          actions.push({
            type: 'shoot',
            projType: this.projectileType,
            origin: origin.clone(),
            target: new THREE.Vector3(
              myPos.x + dx * cos - dz * sin, playerPos.y, myPos.z + dx * sin + dz * cos
            ),
          });
        }
      } else if (this._cooldownTimer <= 0) {
        this._cooldownTimer = this.attackCooldown;
        actions.push({
          type: 'shoot', projType: this.projectileType, origin, target: playerPos.clone(),
        });
      }
    }
    // Poursuit toujours le joueur (rapide en phase 1).
    this._moveToward(dx, dz, dist, delta, level);
  }
}
