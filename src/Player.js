import * as THREE from 'three';
import { PLAYER_EYE } from './level/LevelData.js';

// Joueur FPS : déplacement WASD + course + saut, regard souris (PointerLock),
// gravité, collision axiale via Level.isWalkable, attaque plumeau (mêlée).

const WALK_SPEED = 4.5;
const RUN_SPEED = 7.5;
const GRAVITY = 15;
const JUMP_VELOCITY = 6;
const MOUSE_SENSITIVITY = 0.0022;
const PLAYER_RADIUS = 0.35;
const WEAPON_REST = { x: 0.32, y: -0.28, z: -0.6 };
const STRIDE = 2.2; // distance entre deux pas

export default class Player {
  constructor(camera, input, level) {
    this.camera = camera;
    this.input = input;
    this.level = level;

    this.maxHp = 100;
    this.hp = 100;

    // Régénération lente : reprend après un court délai sans dégât.
    this.hpRegen = 2;       // points de vie par seconde
    this.regenDelay = 6;    // secondes sans dégât avant de régénérer
    this._regenTimer = 0;

    this.yaw = 0;
    this.pitch = 0;

    this.position = new THREE.Vector3(0, PLAYER_EYE, 0);
    this.velocityY = 0;
    this.onGround = true;

    // Arme de mêlée (configurée par niveau via setWeapon).
    this.meleeRange = 2.5;
    this.meleeDamage = 20;
    this.meleeCooldown = 0.5;
    this._meleeTimer = 0;
    this._swingTime = 0; // animation en cours
    this.wantsMeleeHit = false; // consommé par Game ce frame
    this.weapon = null;

    // Boost de dégâts temporaire (consommable de boutique).
    this._baseMeleeDamage = 20;
    this._boostTimer = 0;
    this._boostMult = 1;

    // Effets : screen shake (trauma), balancement d'arme, pas.
    this._trauma = 0;
    this._bobPhase = 0;
    this._stepDist = 0;
    this.wantsStep = false; // consommé par Game ce frame

    this.setWeapon({ build: 'plumeau', meleeDamage: 20, meleeRange: 2.5 });
    this._updateCamera();
  }

  // Configure l'arme du niveau courant : stats + visuel FPS.
  setWeapon(cfg) {
    this._baseMeleeDamage = cfg.meleeDamage;
    this.meleeDamage = cfg.meleeDamage * (this._boostTimer > 0 ? this._boostMult : 1);
    this.meleeRange = cfg.meleeRange;

    if (this.weapon) {
      this.camera.remove(this.weapon);
      this.weapon.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
      });
    }

    this.weapon = new THREE.Group();
    if (cfg.build === 'aspirateur') this._buildAspirateur();
    else this._buildPlumeau();

    // Position de repos à l'écran (bas-droite).
    this.weapon.position.set(0.32, -0.28, -0.6);
    this.weapon.rotation.set(0.2, -0.3, -0.2);
    this.camera.add(this.weapon);
  }

  _buildPlumeau() {
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.6 });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), handleMat
    );
    handle.position.set(0, -0.1, 0);
    this.weapon.add(handle);

    // Plumes (cône fluffy).
    const featherMat = new THREE.MeshStandardMaterial({
      color: 0xff80ab, roughness: 0.9,
    });
    const feathers = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.35, 10), featherMat
    );
    feathers.position.set(0, 0.22, 0);
    this.weapon.add(feathers);
    // Quelques touffes.
    for (let i = 0; i < 5; i++) {
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.95 })
      );
      const a = (i / 5) * Math.PI * 2;
      tuft.position.set(Math.cos(a) * 0.1, 0.28, Math.sin(a) * 0.1);
      tuft.rotation.z = Math.cos(a) * 0.5;
      tuft.rotation.x = Math.sin(a) * 0.5;
      this.weapon.add(tuft);
    }
  }

  _buildAspirateur() {
    // Manche.
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5 });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), handleMat
    );
    handle.position.set(0, -0.12, 0);
    this.weapon.add(handle);

    // Corps moteur (bloc bleu).
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.2), bodyMat);
    body.position.set(0, 0.04, 0);
    this.weapon.add(body);

    // Bande grise sur le corps.
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.4, metalness: 0.4 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.21), bandMat);
    band.position.set(0, 0.08, 0);
    this.weapon.add(band);

    // Tube vers l'embout.
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), bandMat
    );
    tube.position.set(0, 0.3, 0.02);
    tube.rotation.x = 0.25;
    this.weapon.add(tube);

    // Embout aspirateur (suceur évasé).
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.6 });
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.05, 0.16, 12, 1, true), nozzleMat
    );
    nozzle.position.set(0, 0.5, 0.07);
    nozzle.rotation.x = 0.25;
    this.weapon.add(nozzle);
  }

  reset(x, z) {
    this.hp = this.maxHp;
    this.position.set(x, PLAYER_EYE, z);
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this._meleeTimer = 0;
    this._swingTime = 0;
    this._regenTimer = 0;
    this._boostTimer = 0;
    this._boostMult = 1;
    this.meleeDamage = this._baseMeleeDamage;
    this._trauma = 0;
    this._bobPhase = 0;
    this._stepDist = 0;
    this._updateCamera();
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this._regenTimer = this.regenDelay; // suspend la régénération
  }

  // Ajoute du tremblement de caméra (0..1 cumulatif).
  addShake(amount) {
    this._trauma = Math.min(1, this._trauma + amount);
  }

  // Soin instantané (consommable).
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // Active le boost de dégâts pour `duration` secondes (consommable).
  applyDamageBoost(duration, mult) {
    this._boostTimer = duration;
    this._boostMult = mult;
    this.meleeDamage = this._baseMeleeDamage * mult;
  }

  get boostRemaining() {
    return Math.max(0, this._boostTimer);
  }

  _updateBoost(delta) {
    if (this._boostTimer <= 0) return;
    this._boostTimer -= delta;
    if (this._boostTimer <= 0) {
      this._boostTimer = 0;
      this._boostMult = 1;
      this.meleeDamage = this._baseMeleeDamage;
    }
  }

  // Régénère la vie petit à petit après le délai sans dégât.
  _regen(delta) {
    if (this._regenTimer > 0) {
      this._regenTimer -= delta;
      return;
    }
    if (this.hp > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * delta);
    }
  }

  get isDead() {
    return this.hp <= 0;
  }

  update(delta) {
    this.wantsMeleeHit = false;
    this.wantsStep = false;
    this._regen(delta);
    this._updateBoost(delta);
    if (this._trauma > 0) this._trauma = Math.max(0, this._trauma - delta * 1.6);

    // --- Regard souris + stick droit manette ---
    const md = this.input.consumeMouseDelta();
    const tl = this.input.consumeTouchLook();
    const gl = this.input.gpLook;
    const GP_LOOK = 2.8;                       // sensibilité stick droit (rad/s)
    const TOUCH_LOOK = MOUSE_SENSITIVITY * 1.3; // sensibilité regard tactile
    this.yaw   -= md.x * MOUSE_SENSITIVITY + gl.x * GP_LOOK * delta + tl.x * TOUCH_LOOK;
    this.pitch -= md.y * MOUSE_SENSITIVITY + gl.y * GP_LOOK * delta + tl.y * TOUCH_LOOK;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));

    // --- Déplacement clavier (AZERTY via isKey) + stick gauche manette ---
    const gm = this.input.gpMove;
    const running = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')
                 || this.input.gpSprint;
    const speed = running ? RUN_SPEED : WALK_SPEED;

    let fx = 0, fz = 0;
    if (this.input.isKey('z')) fz += 1; // AZERTY avant
    if (this.input.isKey('s')) fz -= 1; // arrière
    if (this.input.isKey('q')) fx -= 1; // AZERTY gauche
    if (this.input.isKey('d')) fx += 1; // droite
    const tm = this.input.touchMove;
    fx += gm.x + tm.x;  // stick gauche / joystick tactile X (+1 = droite)
    fz -= gm.y + tm.y;  // stick gauche / joystick tactile Y (avant = négatif)

    const prevX = this.position.x, prevZ = this.position.z;

    const len = Math.hypot(fx, fz);
    let moveX = 0, moveZ = 0;
    if (len > 0) {
      fx /= len; fz /= len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      moveX = (fx * cos + fz * -sin) * speed * delta;
      moveZ = (fx * -sin + fz * -cos) * speed * delta;
    }

    // Collision axiale avec vérification de traversée de mur (prevX/prevZ).
    const nx = prevX + moveX;
    if (this.level.isWalkable(nx, prevZ, PLAYER_RADIUS, prevX, prevZ)) {
      this.position.x = nx;
    }
    const nz = prevZ + moveZ;
    if (this.level.isWalkable(this.position.x, nz, PLAYER_RADIUS, this.position.x, prevZ)) {
      this.position.z = nz;
    }

    // --- Saut / gravité (clavier Space ou bouton A manette) ---
    const wantsJump = this.input.isDown('Space') || this.input.gpJump || this.input.touchJump;
    if (wantsJump && this.onGround) {
      this.velocityY = JUMP_VELOCITY;
      this.onGround = false;
    }
    this.velocityY -= GRAVITY * delta;
    this.position.y += this.velocityY * delta;
    if (this.position.y <= PLAYER_EYE) {
      this.position.y = PLAYER_EYE;
      this.velocityY = 0;
      this.onGround = true;
    }

    // --- Balancement d'arme + pas (selon distance réellement parcourue) ---
    const movedDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    if (this.onGround && movedDist > 0.0001) {
      this._bobPhase += movedDist * 1.9;
      this._stepDist += movedDist;
      if (this._stepDist >= STRIDE) { this._stepDist = 0; this.wantsStep = true; }
    } else {
      this._stepDist = STRIDE * 0.5; // prochain pas plus rapide au redémarrage
    }

    // --- Plumeau (clic gauche ou bouton X/RB manette) ---
    if (this._meleeTimer > 0) this._meleeTimer -= delta;
    if (this.input.consumeLeftClick() && this._meleeTimer <= 0) {
      this._meleeTimer = this.meleeCooldown;
      this._swingTime = 0.2;
      this.wantsMeleeHit = true;
    }
    this._updateWeaponAnim(delta);

    this._updateCamera();
  }

  _updateWeaponAnim(delta) {
    // Balancement de marche (bob) appliqué à la position de repos.
    const bobX = Math.cos(this._bobPhase) * 0.012;
    const bobY = Math.abs(Math.sin(this._bobPhase)) * 0.018;
    this.weapon.position.set(WEAPON_REST.x + bobX, WEAPON_REST.y + bobY, WEAPON_REST.z);

    if (this._swingTime > 0) {
      this._swingTime -= delta;
      // Inclinaison de l'arme + caméra pendant le coup (~15°).
      const t = 1 - this._swingTime / 0.2; // 0 -> 1
      const swing = Math.sin(t * Math.PI); // monte puis redescend
      this.weapon.rotation.x = 0.2 - swing * 0.9;
      this._camRoll = swing * THREE.MathUtils.degToRad(15);
    } else {
      this.weapon.rotation.x = 0.2;
      this._camRoll = 0;
    }
  }

  _updateCamera() {
    this.camera.position.copy(this.position);
    let roll = this._camRoll || 0;
    if (this._trauma > 0) {
      // Tremblement : quadratique pour un ressenti plus net sur les gros chocs.
      const s = this._trauma * this._trauma;
      this.camera.position.x += (Math.random() * 2 - 1) * s * 0.14;
      this.camera.position.y += (Math.random() * 2 - 1) * s * 0.14;
      roll += (Math.random() * 2 - 1) * s * 0.06;
    }
    const e = new THREE.Euler(this.pitch, this.yaw, roll, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  // Direction horizontale du regard (pour le cône du plumeau).
  getForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
