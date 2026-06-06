import * as THREE from 'three';

// Classe de base : machine à états IDLE / CHASE / ATTACK.
// Les sous-classes définissent le visuel (_buildMesh), les stats, et
// fournissent un projectile via shoot() consommé par Game.

export const STATE = { IDLE: 'idle', CHASE: 'chase', ATTACK: 'attack' };

export default class Enemy {
  constructor(opts) {
    this.hp = opts.hp;
    this.maxHp = opts.hp;
    this.speed = opts.speed;
    this.sightRange = opts.sightRange ?? 15;
    this.attackRange = opts.attackRange;
    this.attackCooldown = opts.attackCooldown;
    this.coinDrop = opts.coinDrop;
    this.projectileType = opts.projectileType;
    this.radius = opts.radius ?? 0.5;

    this.state = STATE.IDLE;
    this._cooldownTimer = 0;
    this.alive = true;
    this.dead = false;

    this.group = new THREE.Group();
    this.group.position.set(opts.x, opts.bodyY ?? 0.5, opts.z);

    this._buildMesh(); // implémenté par les sous-classes
  }

  _buildMesh() { /* override */ }

  // Animation idle (override possible).
  _animate(delta, time) {}

  get position() {
    return this.group.position;
  }

  takeDamage(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.alive = false;
    } else {
      // Flash de dégât rapide.
      this._hitFlash = 0.12;
    }
  }

  // Renvoie un Projectile à émettre, ou null. Surchargé pour le boss.
  _makeProjectile(playerPos) {
    return { kind: 'ranged', type: this.projectileType };
  }

  // Mise à jour IA. Retourne une liste d'actions :
  // { type:'shoot', projType, origin, target } ou { type:'melee', damage }.
  update(delta, playerPos, level) {
    if (this.dead) return [];
    const actions = [];
    const time = performance.now() * 0.001;
    this._animate(delta, time);

    if (this._hitFlash > 0) {
      this._hitFlash -= delta;
      this._setEmissive(this._hitFlash > 0 ? 0.6 : 0);
    }

    const myPos = this.group.position;
    const dx = playerPos.x - myPos.x;
    const dz = playerPos.z - myPos.z;
    const dist = Math.hypot(dx, dz);

    // Rotation vers le joueur.
    this.group.rotation.y = Math.atan2(dx, dz);

    // Transitions d'état.
    if (dist <= this.attackRange) {
      this.state = STATE.ATTACK;
    } else if (dist <= this.sightRange) {
      this.state = STATE.CHASE;
    } else {
      this.state = STATE.IDLE;
    }

    if (this._cooldownTimer > 0) this._cooldownTimer -= delta;

    if (this.state === STATE.CHASE) {
      this._moveToward(dx, dz, dist, delta, level);
    } else if (this.state === STATE.ATTACK) {
      // Reste à distance mais peut s'approcher un peu si très loin du range mêlée.
      this._onAttack(delta, dx, dz, dist, playerPos, level, actions);
    }

    return actions;
  }

  _moveToward(dx, dz, dist, delta, level) {
    if (dist < 0.001) return;
    const nx = dx / dist;
    const nz = dz / dist;
    const step = this.speed * delta;
    const myPos = this.group.position;

    // Mouvement axial : tester X puis Z séparément contre la zone walkable.
    const tryX = myPos.x + nx * step;
    if (level.isWalkableEnemy(tryX, myPos.z, this.radius)) {
      myPos.x = tryX;
    }
    const tryZ = myPos.z + nz * step;
    if (level.isWalkableEnemy(myPos.x, tryZ, this.radius)) {
      myPos.z = tryZ;
    }
  }

  _onAttack(delta, dx, dz, dist, playerPos, level, actions) {
    if (this._cooldownTimer <= 0) {
      const myPos = this.group.position;
      // Ne tire que si la ligne de vue est dégagée.
      if (!level.hasLineOfSight(myPos.x, myPos.z, playerPos.x, playerPos.z)) return;
      this._cooldownTimer = this.attackCooldown;
      const origin = myPos.clone();
      origin.y = myPos.y + 0.2;
      actions.push({
        type: 'shoot',
        projType: this.projectileType,
        origin,
        target: playerPos.clone(),
      });
    }
  }

  _setEmissive(intensity) {
    this.group.traverse((o) => {
      if (o.isMesh && o.material && 'emissiveIntensity' in o.material) {
        o.material.emissive = new THREE.Color(0xff3333);
        o.material.emissiveIntensity = intensity;
      }
    });
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
