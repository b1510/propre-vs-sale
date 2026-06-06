import * as THREE from 'three';
import Room from './Room.js';
import { ROOMS, DOORS, getDoorwayRect, WALL_THICKNESS } from './LevelData.js';

// Test d'intersection segment 2D vs AABB (méthode des dalles).
function _segAABB(x0, z0, dx, dz, box) {
  let tMin = 0, tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < box.minX || x0 > box.maxX) return false;
  } else {
    const t1 = (box.minX - x0) / dx, t2 = (box.maxX - x0) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z0 < box.minZ || z0 > box.maxZ) return false;
  } else {
    const t1 = (box.minZ - z0) / dz, t2 = (box.maxZ - z0) / dz;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return tMin <= tMax;
}

// Construit toute la villa : pièces, murs avec portes, doorways walkables,
// éclairage global, clé. Fournit les requêtes de collision pour le joueur
// (AABB pièces + doorways) et pour l'IA (wall colliders).

export default class Level {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.rooms = {};
    this.wallColliders = [];      // pour l'IA des ennemis
    this.doorways = [];           // rectangles walkables (porte)
    this.lockedDoors = {};        // id -> { door, meshes:[] }
    this.keyMesh = null;
    this.keyCollected = false;

    this._build();
    scene.add(this.group);
  }

  _build() {
    // Crée les pièces.
    for (const name in ROOMS) {
      const room = new Room(name, ROOMS[name]);
      room.addLight();
      room.addFurniture();
      this.rooms[name] = room;
      this.group.add(room.group);
    }

    // Construit les murs périmétriques de chaque pièce avec ouvertures.
    for (const name in ROOMS) {
      const room = this.rooms[name];
      const d = room.def;

      // Récupère les portes affectant chaque côté de cette pièce.
      const doorsOnX = (atX) => DOORS.filter(
        (dr) => dr.orient === 'x' && Math.abs(dr.at - atX) < 0.001 &&
          (dr.roomA === name || dr.roomB === name)
      );
      const doorsOnZ = (atZ) => DOORS.filter(
        (dr) => dr.orient === 'z' && Math.abs(dr.at - atZ) < 0.001 &&
          (dr.roomA === name || dr.roomB === name)
      );

      // Mur ouest (x = minX) et est (x = maxX).
      this._buildSideNS(room, d.minX, d.minZ, d.maxZ, doorsOnX(d.minX));
      this._buildSideNS(room, d.maxX, d.minZ, d.maxZ, doorsOnX(d.maxX));
      // Mur sud (z = minZ) et nord (z = maxZ).
      this._buildSideEW(room, d.minZ, d.minX, d.maxX, doorsOnZ(d.minZ));
      this._buildSideEW(room, d.maxZ, d.minX, d.maxX, doorsOnZ(d.maxZ));

      this.wallColliders.push(...room.wallColliders);
    }

    // Doorways walkables (et portes verrouillées).
    for (const door of DOORS) {
      const rect = getDoorwayRect(door);
      if (door.locked) {
        this.doorways.push({ rect, locked: true, id: door.id });
        this._buildLockedDoor(door, rect);
      } else {
        this.doorways.push({ rect, locked: false, id: door.id });
      }
    }

    this._buildKey();
    this._addGlobalLights();
  }

  _buildSideNS(room, atX, zMin, zMax, doors) {
    if (doors.length === 0) {
      room.buildNSWall(atX, zMin, zMax);
    } else {
      // On suppose au plus une porte par segment de mur dans ce niveau.
      const door = doors[0];
      room.buildNSWall(atX, zMin, zMax, door.pos, door.width);
    }
  }

  _buildSideEW(room, atZ, xMin, xMax, doors) {
    if (doors.length === 0) {
      room.buildEWWall(atZ, xMin, xMax);
    } else {
      const door = doors[0];
      room.buildEWWall(atZ, xMin, xMax, door.pos, door.width);
    }
  }

  _buildLockedDoor(door, rect) {
    // Panneau de porte qui bloque physiquement l'ouverture jusqu'au déverrouillage.
    const mat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.6 });
    let geo, x, z;
    if (door.orient === 'z') {
      geo = new THREE.BoxGeometry(door.width, 2.8, 0.18);
      x = door.pos; z = door.at;
    } else {
      geo = new THREE.BoxGeometry(0.18, 2.8, door.width);
      x = door.at; z = door.pos;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.4, z);
    this.group.add(mesh);

    // Poignée dorée.
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.6, roughness: 0.3 })
    );
    handle.position.set(x + (door.orient === 'z' ? 0.7 : 0), 1.3,
                        z + (door.orient === 'z' ? 0 : 0.7));
    this.group.add(handle);

    // Collider de mur pour l'ouverture — bloque joueur et IA tant que verrouillé.
    const hw = WALL_THICKNESS / 2;
    const wc = door.orient === 'x'
      ? { minX: door.at - hw, maxX: door.at + hw,
          minZ: door.pos - door.width / 2, maxZ: door.pos + door.width / 2 }
      : { minX: door.pos - door.width / 2, maxX: door.pos + door.width / 2,
          minZ: door.at - hw, maxZ: door.at + hw };
    this.wallColliders.push(wc);

    this.lockedDoors[door.id] = { door, meshes: [mesh, handle], rect, opened: false, wallCollider: wc };
  }

  unlockDoor(id) {
    const ld = this.lockedDoors[id];
    if (!ld || ld.opened) return;
    ld.opened = true;
    for (const m of ld.meshes) {
      this.group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    // Supprime le collider de la porte.
    if (ld.wallCollider) {
      const idx = this.wallColliders.indexOf(ld.wallCollider);
      if (idx !== -1) this.wallColliders.splice(idx, 1);
    }
    // Le doorway devient walkable.
    for (const d of this.doorways) {
      if (d.id === id) d.locked = false;
    }
  }

  isLockedDoorClosed(id) {
    const ld = this.lockedDoors[id];
    return ld ? !ld.opened : false;
  }

  _buildKey() {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a, metalness: 0.7, roughness: 0.25,
    });
    // Anneau + tige + dents.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16), goldMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.34), goldMat);
    shaft.position.z = 0.22;
    group.add(shaft);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), goldMat);
    tooth.position.set(0, -0.06, 0.34);
    group.add(tooth);

    group.position.set(19.5, 0.95, 4);
    this.keyMesh = group;
    this.group.add(group);
  }

  collectKey() {
    if (this.keyCollected || !this.keyMesh) return;
    this.keyCollected = true;
    this.group.remove(this.keyMesh);
    this.keyMesh = null;
  }

  _addGlobalLights() {
    const amb = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.25);
    dir.position.set(20, 40, -10);
    this.scene.add(dir);
  }

  // Le point (x,z) est-il dans une pièce (avec marge intérieure radius) ?
  _inAnyRoom(x, z, radius) {
    for (const name in this.rooms) {
      const d = this.rooms[name].def;
      if (x >= d.minX + radius && x <= d.maxX - radius &&
          z >= d.minZ + radius && z <= d.maxZ - radius) {
        return true;
      }
    }
    return false;
  }

  // Le point (x,z) est-il dans un doorway ouvert ?
  _inAnyDoorway(x, z) {
    for (const dw of this.doorways) {
      if (dw.locked) continue;
      const r = dw.rect;
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        return true;
      }
    }
    return false;
  }

  // Position walkable pour le joueur.
  // prevX/prevZ optionnels : si fournis, bloque si le chemin traverse un mur.
  isWalkable(x, z, radius = 0.3, prevX, prevZ) {
    if (prevX !== undefined && this.didCrossWall(prevX, prevZ, x, z)) return false;
    if (this._inAnyDoorway(x, z)) return true;
    return this._inAnyRoom(x, z, radius);
  }

  // Vrai si le segment (x0,z0)→(x1,z1) ne traverse aucun mur (ligne de vue libre).
  hasLineOfSight(x0, z0, x1, z1) {
    return !this.didCrossWall(x0, z0, x1, z1);
  }

  // Walkable pour ennemis : pièces (sans rétrécissement fort) + doorways,
  // et pas à l'intérieur d'un wall collider.
  isWalkableEnemy(x, z, radius = 0.45) {
    let ok = this._inAnyDoorway(x, z) || this._inAnyRoom(x, z, radius);
    if (!ok) return false;
    for (const w of this.wallColliders) {
      if (x >= w.minX - radius && x <= w.maxX + radius &&
          z >= w.minZ - radius && z <= w.maxZ + radius) {
        // Autorisé seulement si on est dans un doorway (passage de porte).
        if (!this._inAnyDoorway(x, z)) return false;
      }
    }
    return true;
  }

  // Vrai si (x,z) est dans l'épaisseur d'un mur (hors ouverture de porte).
  isInWall(x, z) {
    for (const w of this.wallColliders) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) return true;
    }
    return false;
  }

  // Vrai si le segment (x0,z0)→(x1,z1) traverse un mur (collision projectile robuste).
  didCrossWall(x0, z0, x1, z1) {
    if (this.isInWall(x1, z1)) return true;
    const dx = x1 - x0, dz = z1 - z0;
    if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return false;
    for (const w of this.wallColliders) {
      if (_segAABB(x0, z0, dx, dz, w)) return true;
    }
    return false;
  }

  // Renvoie le nom de la pièce contenant le point, ou null.
  getRoomAt(x, z) {
    for (const name in this.rooms) {
      const d = this.rooms[name].def;
      if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) {
        return name;
      }
    }
    return null;
  }

  update(delta) {
    if (this.keyMesh) {
      this.keyMesh.rotation.y += delta * 2;
      this.keyMesh.position.y = 0.95 + Math.sin(performance.now() * 0.003) * 0.06;
    }
  }
}
