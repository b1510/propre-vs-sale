import * as THREE from 'three';

// Projectile tiré par un ennemi vers le joueur. Vit jusqu'à toucher le
// joueur, dépasser sa durée de vie, ou sortir de la zone walkable.

const PROFILES = {
  caca:    { radius: 0.15, color: 0x6B3A2A, speed: 8, damage: 6 },
  poussiere:{ radius: 0.12, color: 0x888888, speed: 7, damage: 5 },
  viande:  { radius: 0.20, color: 0x8B0000, speed: 9, damage: 10 },
  boule_de_feu: { radius: 0.24, color: 0xff5500, speed: 9, damage: 11 },
};

export default class Projectile {
  constructor(type, origin, targetPos) {
    const p = PROFILES[type] || PROFILES.caca;
    this.type = type;
    this.damage = p.damage;
    this.radius = p.radius;
    this.alive = true;
    this.life = 4; // secondes

    const geo = new THREE.SphereGeometry(p.radius, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color, roughness: 0.6, emissive: p.color, emissiveIntensity: 0.15,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin);

    const dir = new THREE.Vector3().subVectors(targetPos, origin).normalize();
    this.velocity = dir.multiplyScalar(p.speed);
  }

  update(delta) {
    this.mesh.position.addScaledVector(this.velocity, delta);
    this.life -= delta;
    if (this.life <= 0) this.alive = false;
  }

  // Distance au joueur (collision sphérique simple).
  hits(playerPos, playerRadius = 0.45) {
    return this.mesh.position.distanceTo(playerPos) <= this.radius + playerRadius;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
