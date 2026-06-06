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

export default class Player {
  constructor(camera, input, level) {
    this.camera = camera;
    this.input = input;
    this.level = level;

    this.maxHp = 100;
    this.hp = 100;

    this.yaw = 0;
    this.pitch = 0;

    this.position = new THREE.Vector3(0, PLAYER_EYE, 0);
    this.velocityY = 0;
    this.onGround = true;

    // Plumeau (mêlée).
    this.meleeRange = 2.5;
    this.meleeDamage = 20;
    this.meleeCooldown = 0.5;
    this._meleeTimer = 0;
    this._swingTime = 0; // animation en cours
    this.wantsMeleeHit = false; // consommé par Game ce frame

    this._buildWeapon();
    this._updateCamera();
  }

  _buildWeapon() {
    // Plumeau attaché à la caméra (vue à la première personne).
    this.weapon = new THREE.Group();

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

    // Position de repos à l'écran (bas-droite).
    this.weapon.position.set(0.32, -0.28, -0.6);
    this.weapon.rotation.set(0.2, -0.3, -0.2);
    this.camera.add(this.weapon);
  }

  reset(x, z) {
    this.hp = this.maxHp;
    this.position.set(x, PLAYER_EYE, z);
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this._meleeTimer = 0;
    this._swingTime = 0;
    this._updateCamera();
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
  }

  get isDead() {
    return this.hp <= 0;
  }

  update(delta) {
    this.wantsMeleeHit = false;

    // --- Regard souris + stick droit manette ---
    const md = this.input.consumeMouseDelta();
    const gl = this.input.gpLook;
    const GP_LOOK = 2.8; // sensibilité stick droit (rad/s)
    this.yaw   -= md.x * MOUSE_SENSITIVITY + gl.x * GP_LOOK * delta;
    this.pitch -= md.y * MOUSE_SENSITIVITY + gl.y * GP_LOOK * delta;
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
    fx += gm.x;  // stick gauche X (+1 = droite)
    fz -= gm.y;  // stick gauche Y (axes inversés : -1 = avant en standard)

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
    const wantsJump = this.input.isDown('Space') || this.input.gpJump;
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
    const e = new THREE.Euler(this.pitch, this.yaw, this._camRoll || 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  // Direction horizontale du regard (pour le cône du plumeau).
  getForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
