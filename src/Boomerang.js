import * as THREE from 'three';

// Tête de l'aspirateur technologique lancée en boomerang : part tout droit,
// blesse les ennemis traversés, puis revient vers le joueur.

const SPEED_OUT = 15;
const SPEED_BACK = 18;
const MAX_DIST = 13;
const CATCH_DIST = 0.9;
const HEIGHT = 1.15;
export const BOOMERANG_HIT_RADIUS = 0.9;

export default class Boomerang {
  constructor(origin, forward, damage) {
    this.dir = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    this.damage = damage;
    this.phase = 'out';
    this.done = false;
    this.traveled = 0;
    this.life = 5;           // sécurité : disparaît quoi qu'il arrive
    this.hit = new Set();    // ennemis déjà touchés sur ce trajet (reset au retour)

    this.mesh = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.07, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.2, metalness: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    // (pas de PointLight : en ajouter une en cours de jeu recompile tous les matériaux)
    this.mesh.add(ring, disc);
    this.mesh.position.set(origin.x, HEIGHT, origin.z);
  }

  get position() {
    return this.mesh.position;
  }

  // Avance d'un pas. `playerPos` : cible du retour. `level` : collisions murs.
  update(delta, playerPos, level) {
    const p = this.mesh.position;
    const prevX = p.x, prevZ = p.z;
    this.mesh.rotation.y += delta * 28;
    this.life -= delta;
    if (this.life <= 0) { this.done = true; return; }

    if (this.phase === 'out') {
      const step = SPEED_OUT * delta;
      p.x += this.dir.x * step;
      p.z += this.dir.z * step;
      this.traveled += step;
      if (level.didCrossWall(prevX, prevZ, p.x, p.z)) {
        p.x = prevX; p.z = prevZ;       // rebondit sur le mur : fait demi-tour
        this._startReturn();
      } else if (this.traveled >= MAX_DIST) {
        this._startReturn();
      }
    } else {
      const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < CATCH_DIST) { this.done = true; return; }
      const step = Math.min(SPEED_BACK * delta, d);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      // Un mur entre le boomerang et le joueur (il a tourné un coin) : rattrapé.
      if (level.didCrossWall(prevX, prevZ, p.x, p.z)) this.done = true;
    }
  }

  _startReturn() {
    this.phase = 'back';
    this.hit.clear(); // peut blesser une 2e fois au retour
  }

  dispose() {
    this.mesh.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
  }
}
