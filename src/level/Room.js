import * as THREE from 'three';
import { WALL_THICKNESS, ROOM_HEIGHT } from './LevelData.js';
import {
  woodFloor, tileFloor, metalFloor,
  wallpaper, subwayTile, brickWall, concreteWall,
  ceilingPlaster, ceilingTile, woodCeiling,
} from './Textures.js';

// Choisit la texture de sol selon le type de pièce.
// Pièces métalliques de l'usine de robots (niveau 4).
const isRobotFactory = (name) =>
  name.startsWith('construction') || name.startsWith('test') || name === 'preparation';

function pickFloorTexture(name, rx, ry) {
  // Niveau 4 : usine de robots.
  if (name === 'jungle') return { map: null, normalMap: null, roughnessMap: null }; // herbe : couleur unie + décor
  if (isRobotFactory(name)) return metalFloor(rx, ry);
  if (name === 'entrepot') return concreteWall(rx, ry);
  if (name === 'hall_entree' || name === 'arene') return tileFloor(rx, ry);
  if (name === 'cour') {
    return concreteWall(rx, ry);                      // cour : bitume
  }
  if (name.startsWith('machines') || name.startsWith('dangereuse')) {
    return metalFloor(rx, ry);                       // usine : sol métal
  }
  if (name === 'cuisine' || name === 'salle_bains' || name === 'sucree' ||
      name === 'pause' || name.startsWith('toilettes')) {
    return tileFloor(rx, ry);                         // pièces « humides » / carrelées
  }
  return woodFloor(rx, ry);                           // séjour : parquet
}

// Teintes de papier peint par pièce (l'albédo neutre est multiplié).
const WALLPAPER_TINT = {
  hall: 0xF1ECE0, salon: 0xF0E6D2, chambre1: 0xDCE6F2,
  chambre2: 0xE9DCF2, chambre3: 0xDDF0DE, salle_jeu: 0x99A2AE,
  grenier: 0xCFC2B0,
  // Niveau 3 — l'école : tons pastel de salle de classe.
  classe1: 0xFFF3D6, classe2: 0xDCF0F5, classe3: 0xE6F5DC, classe4: 0xFAE0E4,
  salle_maitres: 0xE4E0D2, salle_activite: 0xFFEBC7, dortoir: 0xD3DCF0,
};

// Choisit la texture + le matériau des MURS selon la pièce.
// Renvoie { set, color, normalScale, metalness, roughness }.
function pickWallTexture(name) {
  // Niveau 4 : usine de robots.
  if (name === 'jungle') {
    return { set: concreteWall(4, 2), color: 0x7C8F6E, normalScale: 0.8, roughness: 1.0 }; // falaise moussue
  }
  if (name === 'arene') {
    return { set: subwayTile(6, 3), color: 0xBFE6F5, normalScale: 0.4, roughness: 0.6 };   // chambre froide
  }
  if (name === 'entrepot') {
    return { set: brickWall(4, 3), color: 0xB89A86, normalScale: 0.6, roughness: 1.0 };
  }
  if (name.startsWith('test')) {
    return { set: subwayTile(4, 3), color: 0xE3F2FD, normalScale: 0.4, roughness: 1.0 };   // labo
  }
  if (name.startsWith('construction') || name === 'preparation') {
    return { set: concreteWall(3, 2), color: 0xB4B9BD, normalScale: 0.6, roughness: 1.0 };
  }
  // Cour : mur d'enceinte en brique.
  if (name === 'cour') {
    return { set: brickWall(6, 3), color: 0xC9A38B, normalScale: 0.6, roughness: 1.0 };
  }
  // Pièces carrelées : faïence métro brillante.
  if (name === 'cuisine' || name === 'salle_bains' ||
      name === 'sucree' || name === 'pause' || name.startsWith('toilettes')) {
    return { set: subwayTile(4, 3), color: 0xffffff, normalScale: 0.4, roughness: 1.0 };
  }
  // Usine : béton banché.
  if (name.startsWith('machines') || name.startsWith('dangereuse')) {
    return { set: concreteWall(3, 2), color: 0xC4C4C4, normalScale: 0.6, roughness: 1.0 };
  }
  // Grenier : briques apparentes.
  if (name === 'grenier') {
    return { set: brickWall(4, 3), color: 0xffffff, normalScale: 0.6, roughness: 1.0 };
  }
  // Pièces de vie : papier peint teinté.
  return {
    set: wallpaper(3, 3), color: WALLPAPER_TINT[name] || 0xF5F0E8,
    normalScale: 0.4, roughness: 1.0,
  };
}

// Choisit la texture + le matériau du PLAFOND selon la pièce.
function pickCeilTexture(name, rx, ry) {
  if (isRobotFactory(name) || name === 'entrepot' || name === 'arene') {
    return { set: ceilingTile(rx, ry), color: 0xFFFFFF, normalScale: 0.5 }; // dalles de l'usine
  }
  if (name.startsWith('machines') || name.startsWith('dangereuse')) {
    return { set: ceilingTile(rx, ry), color: 0xFFFFFF, normalScale: 0.5 }; // dalles
  }
  if (name === 'grenier') {
    return { set: woodCeiling(2, 2), color: 0xFFFFFF, normalScale: 0.7 };   // lambris bois
  }
  if (name.startsWith('classe') || name === 'salle_activite') {
    return { set: ceilingTile(rx, ry), color: 0xFFFFFF, normalScale: 0.5 }; // dalles d'école
  }
  return { set: ceilingPlaster(2, 2), color: 0xFAFAFA, normalScale: 0.4 };  // caissons
}

// Une pièce : sol, plafond, murs avec ouvertures de portes, lumière ponctuelle.
// Les murs générés sont ajoutés au tableau `wallColliders` (utilisé par l'IA
// des ennemis uniquement ; le joueur utilise les AABB des pièces).

export default class Room {
  constructor(name, def) {
    this.name = name;
    this.def = def;
    this.group = new THREE.Group();
    this.wallColliders = []; // { minX, maxX, minZ, maxZ } en world XZ

    this.width = def.maxX - def.minX;
    this.depth = def.maxZ - def.minZ;
    this.cx = (def.minX + def.maxX) / 2;
    this.cz = (def.minZ + def.maxZ) / 2;

    // Sol texturé PBR (la map multiplie la couleur propre à la pièce ;
    // normalMap = relief réaliste ; roughnessMap = reflets variés).
    const frx = Math.max(1, Math.round(this.width / 4));
    const fry = Math.max(1, Math.round(this.depth / 4));
    const isMetal = name.startsWith('machines') || name.startsWith('dangereuse') || isRobotFactory(name);
    this.animators = []; // callbacks (delta, time) pour les décors animés
    const floor = pickFloorTexture(name, frx, fry);
    this._floorMat = new THREE.MeshStandardMaterial({
      color: def.floorColor, roughness: 0.85, metalness: isMetal ? 0.55 : 0.04,
      map: floor.map, normalMap: floor.normalMap, roughnessMap: floor.roughnessMap,
      normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.0,
    });

    // Murs : texture détaillée selon le type de pièce (faïence, briques,
    // béton, papier peint teinté).
    const wall = pickWallTexture(name);
    this._wallMat = new THREE.MeshStandardMaterial({
      color: wall.color, roughness: wall.roughness, metalness: 0.0,
      map: wall.set.map, normalMap: wall.set.normalMap, roughnessMap: wall.set.roughnessMap,
      normalScale: new THREE.Vector2(wall.normalScale, wall.normalScale),
    });

    // Plafond : caissons (vie), dalles suspendues (usine) ou lambris (grenier).
    // Pièce extérieure : la dalle devient un ciel plat, insensible aux lumières
    // et au brouillard, pour ne pas lire comme un plafond.
    if (def.outdoor) {
      this._ceilMat = new THREE.MeshBasicMaterial({ color: 0x8EC5E8, fog: false });
    } else {
      const ceil = pickCeilTexture(name, 2, 2);
      this._ceilMat = new THREE.MeshStandardMaterial({
        color: ceil.color, roughness: 1.0,
        map: ceil.set.map, normalMap: ceil.set.normalMap, roughnessMap: ceil.set.roughnessMap,
        normalScale: new THREE.Vector2(ceil.normalScale, ceil.normalScale),
      });
    }

    this._buildFloorCeil();
  }

  _buildFloorCeil() {
    const floorGeo = new THREE.BoxGeometry(this.width, 0.1, this.depth);
    const floor = new THREE.Mesh(floorGeo, this._floorMat);
    floor.position.set(this.cx, -0.05, this.cz);
    floor.receiveShadow = true;
    this.group.add(floor);

    const ceilGeo = new THREE.BoxGeometry(this.width, 0.1, this.depth);
    const ceil = new THREE.Mesh(ceilGeo, this._ceilMat);
    ceil.position.set(this.cx, ROOM_HEIGHT + 0.05, this.cz);
    this.group.add(ceil);
  }

  _addWallCollider(minX, maxX, minZ, maxZ) {
    this.wallColliders.push({ minX, maxX, minZ, maxZ });
  }

  // Mur orienté Nord/Sud (s'étend le long de Z, fin en X) à x = atX.
  // Optionnellement une ouverture centrée sur z = openPos de largeur openW.
  buildNSWall(atX, zMin, zMax, openPos = null, openW = 0) {
    const segments = [];
    if (openPos === null) {
      segments.push([zMin, zMax]);
    } else {
      const a = openPos - openW / 2;
      const b = openPos + openW / 2;
      if (a > zMin) segments.push([zMin, a]);
      if (b < zMax) segments.push([b, zMax]);
    }
    for (const [s, e] of segments) {
      const len = e - s;
      if (len <= 0.001) continue;
      const geo = new THREE.BoxGeometry(WALL_THICKNESS, ROOM_HEIGHT, len);
      const mesh = new THREE.Mesh(geo, this._wallMat);
      mesh.position.set(atX, ROOM_HEIGHT / 2, (s + e) / 2);
      mesh.castShadow = true;
      this.group.add(mesh);
      this._addWallCollider(
        atX - WALL_THICKNESS / 2, atX + WALL_THICKNESS / 2, s, e
      );
    }
  }

  // Mur orienté Est/Ouest (s'étend le long de X, fin en Z) à z = atZ.
  buildEWWall(atZ, xMin, xMax, openPos = null, openW = 0) {
    const segments = [];
    if (openPos === null) {
      segments.push([xMin, xMax]);
    } else {
      const a = openPos - openW / 2;
      const b = openPos + openW / 2;
      if (a > xMin) segments.push([xMin, a]);
      if (b < xMax) segments.push([b, xMax]);
    }
    for (const [s, e] of segments) {
      const len = e - s;
      if (len <= 0.001) continue;
      const geo = new THREE.BoxGeometry(len, ROOM_HEIGHT, WALL_THICKNESS);
      const mesh = new THREE.Mesh(geo, this._wallMat);
      mesh.position.set((s + e) / 2, ROOM_HEIGHT / 2, atZ);
      mesh.castShadow = true;
      this.group.add(mesh);
      this._addWallCollider(
        s, e, atZ - WALL_THICKNESS / 2, atZ + WALL_THICKNESS / 2
      );
    }
  }

  addLight() {
    // Extérieur : lumière du jour. Le PointLight de portée 20 ne couvre pas une
    // cour de 36×20, on passe donc sur hémisphérique + directionnelle + appoints.
    if (this.def.outdoor) {
      const sky = new THREE.HemisphereLight(0xBFD8FF, 0x6B7A55, 0.85);
      sky.position.set(this.cx, ROOM_HEIGHT, this.cz);
      this.group.add(sky);

      const sun = new THREE.DirectionalLight(0xFFF4E0, 0.5);
      sun.position.set(this.cx - 10, 12, this.cz - 8);
      sun.target.position.set(this.cx, 0, this.cz);
      this.group.add(sun);
      this.group.add(sun.target);

      for (const dx of [-9, 9]) {
        const fill = new THREE.PointLight(0xffffff, 0.55, 24);
        fill.position.set(this.cx + dx, 2.6, this.cz);
        this.group.add(fill);
      }
      return;
    }

    // Chambre froide : plus vaste, éclairage bleuté.
    if (this.name === 'arene') {
      const cold = new THREE.PointLight(0xD6EEFF, 1.4, 30);
      cold.position.set(this.cx, 2.6, this.cz);
      this.group.add(cold);
      return;
    }

    const light = new THREE.PointLight(0xffffff, 1, 20);
    light.position.set(this.cx, 2.5, this.cz);
    this.group.add(light);
  }

  // Anime les décors (tapis roulants, cascade…).
  update(delta, time) {
    for (const fn of this.animators) fn(delta, time);
  }

  // Meubles décoratifs (non collidables). w,h,d = dimensions ; y = centre vertical.
  addFurniture() {
    const ab = (w, h, d, x, y, z, color) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
      );
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
    };
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Niveau 2 — dispatch par type de pièce (noms partagés entre 5 salles
    // machines, 3 salles dangereuses, 2 toilettes).
    if (this.name.startsWith('machines'))   { this._furnishMachines(ab); return; }
    if (this.name.startsWith('dangereuse')) { this._furnishBroyeur(ab); return; }
    if (this.name === 'sucree')             { this._furnishSucree(ab); return; }
    if (this.name === 'pause')              { this._furnishPause(ab); return; }
    if (this.name.startsWith('toilettes') && this.name !== 'toilettes') {
      this._furnishToilet(ab); return;
    }

    // Niveau 4 — l'usine de robots.
    if (this.name.startsWith('construction')) { this._furnishConstruction(ab); return; }
    if (this.name.startsWith('test'))         { this._furnishTest(ab); return; }
    if (this.name === 'preparation')          { this._furnishPreparation(ab); return; }
    if (this.name === 'entrepot')             { this._furnishEntrepot(ab); return; }
    if (this.name === 'hall_entree')          { this._furnishHallUsine(ab); return; }
    if (this.name === 'arene')                { this._furnishArene(ab); return; }
    if (this.name === 'jungle')               { this._furnishJungle(ab); return; }

    // Niveau 3 — l'école.
    if (this.name === 'cour')            { this._furnishCour(ab); return; }
    if (this.name.startsWith('classe'))  { this._furnishClasse(ab); return; }
    if (this.name === 'salle_maitres')   { this._furnishSalleMaitres(ab); return; }
    if (this.name === 'salle_activite')  { this._furnishSalleActivite(ab); return; }
    if (this.name === 'dortoir')         { this._furnishDortoir(ab); return; }

    switch (this.name) {
      case 'hall': {
        // Console murale nord
        ab(1.2, 0.06, 0.38, cx - 3.5, 0.85, minZ + 0.25, 0x6d4c41);
        ab(1.2, 0.82, 0.06, cx - 3.5, 0.44, minZ + 0.06, 0x5d4037); // panneau avant
        // Vase sur la console
        ab(0.14, 0.28, 0.14, cx - 3.5, 1.0, minZ + 0.25, 0x5c8a8a);
        // Porte-manteau (poteau + bras)
        ab(0.07, 1.65, 0.07, cx + 4.5, 0.825, minZ + 0.35, 0x4e342e);
        ab(0.55, 0.05, 0.05, cx + 4.5, 1.6, minZ + 0.35, 0x4e342e);
        // Miroir sur le mur ouest
        ab(0.06, 0.85, 0.65, minX + 0.06, 1.55, cz - 1.5, 0xb0bec5);
        break;
      }
      case 'salon': {
        // Tapis
        ab(5.5, 0.02, 4.5, cx, 0.01, cz - 1, 0x8d6e63);
        // Canapé 3 places
        ab(3.6, 0.44, 1.0, cx - 0.5, 0.22, cz + 2.8, 0x37474f);
        ab(3.6, 0.55, 0.22, cx - 0.5, 0.28, cz + 3.35, 0x37474f); // dossier
        ab(0.22, 0.55, 1.0, cx - 2.41, 0.28, cz + 2.8, 0x37474f); // accoudoir g
        ab(0.22, 0.55, 1.0, cx + 1.41, 0.28, cz + 2.8, 0x37474f); // accoudoir d
        // Coussin
        ab(0.65, 0.14, 0.55, cx - 1.1, 0.51, cz + 2.6, 0x546e7a);
        ab(0.65, 0.14, 0.55, cx + 0.3, 0.51, cz + 2.6, 0x546e7a);
        // Fauteuil
        ab(0.9, 0.4, 0.9, cx + 3.2, 0.2, cz + 1.5, 0x4a6572);
        ab(0.9, 0.5, 0.18, cx + 3.2, 0.25, cz + 2.0, 0x4a6572);
        // Table basse avec pieds
        ab(1.6, 0.06, 0.9, cx - 0.5, 0.43, cz + 0.8, 0x5d4037);
        ab(0.06, 0.4, 0.06, cx - 1.2, 0.2, cz + 0.45, 0x4e342e);
        ab(0.06, 0.4, 0.06, cx + 0.2, 0.2, cz + 0.45, 0x4e342e);
        ab(0.06, 0.4, 0.06, cx - 1.2, 0.2, cz + 1.15, 0x4e342e);
        ab(0.06, 0.4, 0.06, cx + 0.2, 0.2, cz + 1.15, 0x4e342e);
        // Meuble TV
        ab(2.2, 0.5, 0.38, cx + 2.5, 0.25, minZ + 0.25, 0x263238);
        // Écran TV
        ab(2.0, 1.05, 0.07, cx + 2.5, 1.05, minZ + 0.22, 0x0a0a12);
        // Étagère murale côté ouest
        ab(0.22, 2.2, 2.8, minX + 0.15, 1.1, cz - 2.5, 0x6d4c41);
        ab(2.8, 0.06, 0.2, minX + 0.15, 1.8, cz - 2.5, 0x8d6e63);
        ab(2.8, 0.06, 0.2, minX + 0.15, 1.05, cz - 2.5, 0x8d6e63);
        break;
      }
      case 'cuisine': {
        // Plan de travail en L (côté nord + côté est)
        ab(maxX - minX - 0.8, 0.06, 0.65, cx + 0.4, 0.9, minZ + 0.38, 0x90a4ae); // plan nord
        ab(0.65, 0.06, maxZ - minZ - 0.8, maxX - 0.38, 0.9, cz + 0.4, 0x90a4ae); // plan est
        // Corps des placards sous le plan
        ab(maxX - minX - 0.8, 0.88, 0.6, cx + 0.4, 0.44, minZ + 0.35, 0x78909c);
        ab(0.6, 0.88, maxZ - minZ - 0.8, maxX - 0.35, 0.44, cz + 0.4, 0x78909c);
        // Évier (carré blanc sur le plan nord)
        ab(0.65, 0.08, 0.5, cx + 1.2, 0.95, minZ + 0.36, 0xeceff1);
        // FRIGO — grand et visible
        ab(0.78, 1.9, 0.72, minX + 0.5, 0.95, minZ + 0.42, 0xdce8ea);
        ab(0.06, 0.9, 0.66, minX + 0.12, 0.95, minZ + 0.42, 0xc5cae9); // poignée panneau
        // Micro-ondes
        ab(0.55, 0.32, 0.38, minX + 1.65, 1.08, minZ + 0.3, 0x37474f);
        // TABLE ronde centrale avec pied
        ab(1.3, 0.06, 1.3, cx - 1.8, 0.77, cz + 1.2, 0xd7ccc8);
        ab(0.08, 0.74, 0.08, cx - 1.8, 0.38, cz + 1.2, 0xa1887f);
        // 4 CHAISES autour de la table
        // Nord
        ab(0.46, 0.05, 0.46, cx - 1.8, 0.46, cz + 0.42, 0xbcaaa4);
        ab(0.46, 0.42, 0.06, cx - 1.8, 0.69, cz + 0.2, 0xbcaaa4);
        // Sud
        ab(0.46, 0.05, 0.46, cx - 1.8, 0.46, cz + 1.98, 0xbcaaa4);
        ab(0.46, 0.42, 0.06, cx - 1.8, 0.69, cz + 2.2, 0xbcaaa4);
        // Ouest
        ab(0.46, 0.05, 0.46, cx - 2.58, 0.46, cz + 1.2, 0xbcaaa4);
        ab(0.06, 0.42, 0.46, cx - 2.8, 0.69, cz + 1.2, 0xbcaaa4);
        // Est
        ab(0.46, 0.05, 0.46, cx - 1.02, 0.46, cz + 1.2, 0xbcaaa4);
        ab(0.06, 0.42, 0.46, cx - 0.8, 0.69, cz + 1.2, 0xbcaaa4);
        break;
      }
      case 'chambre1': {
        // LIT double avec tête de lit
        ab(2.2, 0.16, 3.2, cx + 2, 0.08, cz - 1.5, 0x5d4037);    // cadre
        ab(2.2, 0.26, 3.2, cx + 2, 0.29, cz - 1.5, 0xfafafa);    // matelas
        ab(2.2, 0.6, 0.14, cx + 2, 0.3, minZ + 0.2, 0x5d4037);   // tête de lit
        ab(2.2, 0.5, 3.2, cx + 2, 0.65, cz - 1.5, 0x90caf9);     // couverture bleue
        ab(0.9, 0.2, 0.6, cx + 1.2, 0.58, minZ + 0.7, 0xffffff); // oreiller g
        ab(0.9, 0.2, 0.6, cx + 2.8, 0.58, minZ + 0.7, 0xffffff); // oreiller d
        // Table de nuit
        ab(0.52, 0.5, 0.42, maxX - 0.55, 0.25, minZ + 0.55, 0x6d4c41);
        ab(0.52, 0.06, 0.38, maxX - 0.55, 0.52, minZ + 0.55, 0x8d6e63); // dessus
        // BUREAU + CHAISE
        ab(1.45, 0.06, 0.7, minX + 1.1, 0.78, cz + 2.2, 0x795548);    // plateau
        ab(1.45, 0.76, 0.06, minX + 1.1, 0.4, cz + 2.58, 0x6d4c41);   // fond
        ab(0.46, 0.06, 0.46, minX + 1.1, 0.48, cz + 1.4, 0xa1887f);   // chaise assise
        ab(0.46, 0.42, 0.06, minX + 1.1, 0.71, cz + 1.18, 0xa1887f);  // chaise dossier
        // Armoire
        ab(0.38, 2.1, 1.9, maxX - 0.22, 1.05, cz + 2.3, 0x6d4c41);
        break;
      }
      case 'chambre2': {
        // COMMODE avec la clé (position exacte de KEY_POSITION)
        ab(1.65, 0.9, 0.65, 19.5, 0.45, 4, 0x5d4037);
        ab(1.6, 0.06, 0.6, 19.5, 0.93, 4, 0x6d4c41); // dessus commode
        // LIT double
        ab(2.2, 0.16, 3.2, cx + 3, 0.08, cz - 1.5, 0x6d4c41);
        ab(2.2, 0.26, 3.2, cx + 3, 0.29, cz - 1.5, 0xfafafa);
        ab(2.2, 0.6, 0.14, cx + 3, 0.3, minZ + 0.2, 0x6d4c41);
        ab(2.2, 0.5, 3.2, cx + 3, 0.65, cz - 1.5, 0xce93d8);  // couverture violette
        ab(0.9, 0.2, 0.6, cx + 2.2, 0.58, minZ + 0.7, 0xffffff);
        ab(0.9, 0.2, 0.6, cx + 3.8, 0.58, minZ + 0.7, 0xffffff);
        // BUREAU
        ab(1.45, 0.06, 0.7, cx - 2.5, 0.78, cz + 2.2, 0x8d6e63);
        ab(1.45, 0.76, 0.06, cx - 2.5, 0.4, cz + 2.58, 0x795548);
        ab(0.46, 0.06, 0.46, cx - 2.5, 0.48, cz + 1.4, 0xa1887f);
        ab(0.46, 0.42, 0.06, cx - 2.5, 0.71, cz + 1.18, 0xa1887f);
        // Lampe de bureau
        ab(0.08, 0.35, 0.08, cx - 1.9, 0.97, cz + 2.0, 0x888888);
        ab(0.32, 0.14, 0.22, cx - 1.9, 1.19, cz + 2.0, 0xffe082);
        // Armoire
        ab(0.38, 2.1, 2.1, maxX - 0.22, 1.05, cz - 1.0, 0x795548);
        break;
      }
      case 'chambre3': {
        // LIT double
        ab(2.2, 0.16, 3.2, cx + 2.5, 0.08, cz - 1.5, 0x4e342e);
        ab(2.2, 0.26, 3.2, cx + 2.5, 0.29, cz - 1.5, 0xf5f5f5);
        ab(2.2, 0.6, 0.14, cx + 2.5, 0.3, minZ + 0.2, 0x4e342e);
        ab(2.2, 0.5, 3.2, cx + 2.5, 0.65, cz - 1.5, 0xa5d6a7);  // couverture verte
        ab(0.9, 0.2, 0.6, cx + 1.7, 0.58, minZ + 0.7, 0xffffff);
        ab(0.9, 0.2, 0.6, cx + 3.3, 0.58, minZ + 0.7, 0xffffff);
        // BUREAU + CHAISE
        ab(1.45, 0.06, 0.7, cx - 3.5, 0.78, cz + 2.2, 0x6d4c41);
        ab(1.45, 0.76, 0.06, cx - 3.5, 0.4, cz + 2.58, 0x5d4037);
        ab(0.46, 0.06, 0.46, cx - 3.5, 0.48, cz + 1.4, 0xa1887f);
        ab(0.46, 0.42, 0.06, cx - 3.5, 0.71, cz + 1.18, 0xa1887f);
        // BIBLIOTHÈQUE (étagères + planches)
        ab(0.28, 2.2, 3.2, minX + 0.18, 1.1, cz - 0.6, 0x6d4c41);
        ab(3.2, 0.06, 0.24, minX + 0.18, 1.82, cz - 0.6, 0x8d6e63);
        ab(3.2, 0.06, 0.24, minX + 0.18, 1.1, cz - 0.6, 0x8d6e63);
        ab(3.2, 0.06, 0.24, minX + 0.18, 0.4, cz - 0.6, 0x8d6e63);
        // Livres (quelques boîtes décoratives)
        ab(0.14, 0.22, 0.22, minX + 0.8, 1.94, cz - 0.62, 0xe53935);
        ab(0.12, 0.24, 0.22, minX + 1.05, 1.95, cz - 0.62, 0x1e88e5);
        ab(0.16, 0.2, 0.22, minX + 1.28, 1.93, cz - 0.62, 0x43a047);
        break;
      }
      case 'toilettes': {
        // Toilettes : x[3,13] z[8,16] → cx=8, cz=12
        const twcx = cx + 2;      // x=10, bien visible
        const twcz = maxZ - 0.9;  // z≈15.1, loin du mur arrière
        // Cuvette principale (blanc cassé)
        ab(0.68, 0.44, 0.78, twcx, 0.22, twcz, 0xf0f4f8);
        // Lunette/abattant
        ab(0.62, 0.06, 0.70, twcx, 0.47, twcz, 0xffffff);
        // Réservoir (haut, contre le mur arrière)
        ab(0.60, 0.28, 0.22, twcx, 0.56, maxZ - 0.22, 0xf0f4f8);
        // Bouton chasse d'eau
        ab(0.12, 0.06, 0.12, twcx, 0.71, maxZ - 0.14, 0xb0bec5);
        // Lavabo sur colonne
        ab(0.62, 0.22, 0.46, maxX - 1.1, 0.84, minZ + 0.4, 0xffffff);
        ab(0.08, 0.76, 0.08, maxX - 0.88, 0.38, minZ + 0.36, 0xb0bec5);
        ab(0.08, 0.76, 0.08, maxX - 1.32, 0.38, minZ + 0.36, 0xb0bec5);
        // Miroir au-dessus du lavabo
        ab(0.06, 0.68, 0.58, maxX - 0.06, 1.38, minZ + 0.5, 0xb0bec5);
        // Papier toilette
        ab(0.16, 0.16, 0.16, twcx + 0.52, 0.70, twcz - 0.28, 0xfafafa);
        break;
      }
      case 'salle_bains': {
        // BAIGNOIRE détaillée
        ab(2.0, 0.58, 0.88, minX + 1.15, 0.29, maxZ - 0.55, 0xeceff1);
        ab(1.76, 0.06, 0.64, minX + 1.15, 0.59, maxZ - 0.55, 0xffffff); // fond
        ab(0.06, 0.2, 0.06, minX + 1.15, 0.7, maxZ - 0.95, 0xb0bec5);   // robinet
        // Meuble + vasque
        ab(0.95, 0.82, 0.52, maxX - 0.58, 0.41, minZ + 0.34, 0xeceff1);
        ab(0.82, 0.16, 0.44, maxX - 0.58, 0.9, minZ + 0.34, 0xffffff);
        // Miroir mural
        ab(0.06, 0.72, 0.92, maxX - 0.06, 1.42, minZ + 0.68, 0xb0bec5);
        // Porte-serviettes (barre)
        ab(0.04, 0.04, 0.6, maxX - 0.08, 1.15, minZ + 1.6, 0xc0c0c0);
        ab(0.04, 0.18, 0.04, maxX - 0.08, 1.15, minZ + 1.3, 0xc0c0c0);
        ab(0.04, 0.18, 0.04, maxX - 0.08, 1.15, minZ + 1.9, 0xc0c0c0);
        break;
      }
      case 'salle_jeu': {
        // Bureau gaming
        ab(2.1, 0.06, 0.9, cx + 4.5, 0.78, minZ + 0.55, 0x1a1a2e);
        ab(1.9, 0.75, 0.06, cx + 4.5, 0.4, minZ + 1.02, 0x263238);
        // Écran gaming (large)
        ab(1.85, 0.95, 0.07, cx + 4.5, 1.29, minZ + 0.52, 0x080818);
        // PC tour
        ab(0.2, 0.48, 0.42, cx + 5.65, 0.24, minZ + 0.55, 0x37474f);
        // Chaise gaming
        ab(0.58, 0.06, 0.58, cx + 3.6, 0.49, minZ + 1.8, 0x9c0000);
        ab(0.58, 0.65, 0.08, cx + 3.6, 0.8, minZ + 2.12, 0x9c0000);
        ab(0.58, 0.2, 0.08, cx + 3.6, 0.55, minZ + 1.48, 0x7b0000); // rebord siège
        // TABLE DE BILLARD
        ab(3.1, 0.16, 1.85, cx - 2, 0.82, cz + 1, 0x2e7d32);  // tapis vert
        ab(3.5, 0.16, 2.25, cx - 2, 0.62, cz + 1, 0x4e342e);  // bords bois
        ab(3.5, 0.62, 0.1, cx - 2, 0.31, cz - 0.12, 0x4e342e); // côté N
        ab(3.5, 0.62, 0.1, cx - 2, 0.31, cz + 2.12, 0x4e342e); // côté S
        ab(0.1, 0.62, 2.25, cx - 3.8, 0.31, cz + 1, 0x4e342e); // côté O
        ab(0.1, 0.62, 2.25, cx - 0.2, 0.31, cz + 1, 0x4e342e); // côté E
        // Étagères jeux murales
        ab(0.24, 2.2, 2.5, minX + 0.15, 1.1, cz + 4.5, 0x4e342e);
        ab(2.5, 0.06, 0.22, minX + 0.15, 1.8, cz + 4.5, 0x6d4c41);
        ab(2.5, 0.06, 0.22, minX + 0.15, 1.0, cz + 4.5, 0x6d4c41);
        // Canapé gaming
        ab(2.4, 0.42, 1.0, cx, maxZ - 1.8, 0.21, 0x263238);
        ab(2.4, 0.52, 0.22, cx, maxZ - 1.35, 0.26, 0x263238);
        break;
      }
      case 'grenier': {
        // Caisses empilées
        ab(1.1, 0.85, 1.0, minX + 1.3, 0.425, minZ + 1.8, 0x795548);
        ab(0.85, 0.85, 0.85, minX + 2.5, 0.425, minZ + 1.5, 0x6d4c41);
        ab(0.85, 0.85, 0.85, minX + 1.35, 1.3, minZ + 1.8, 0x5d4037); // caisse sur caisse
        ab(1.3, 0.65, 1.1, maxX - 1.4, 0.325, minZ + 1.8, 0x4e342e);
        ab(0.9, 0.65, 0.9, maxX - 1.4, 0.975, minZ + 1.8, 0x5d4037);
        // Vieux canapé recouvert d'un drap gris
        ab(2.1, 0.52, 1.1, cx - 3, 0.26, maxZ - 2, 0x9e9e9e);
        ab(2.1, 0.52, 0.16, cx - 3, 0.52, maxZ - 1.6, 0x9e9e9e); // dossier
        // Vieille armoire
        ab(0.38, 2.05, 1.6, cx + 3.5, 1.025, minZ + 1.8, 0x4e342e);
        // Lampe de chevet posée par terre
        ab(0.18, 0.45, 0.18, cx, 0.225, minZ + 3, 0x888888);
        ab(0.38, 0.28, 0.32, cx, 0.59, minZ + 3, 0xffe082);
        break;
      }
    }
  }

  // --- Helpers de formes (cylindres / cônes) pour le décor du niveau 2 ---
  _addCyl(rTop, rBot, h, x, y, z, color, rough = 0.7) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, h, 12),
      new THREE.MeshStandardMaterial({ color, roughness: rough })
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    this.group.add(m);
    return m;
  }

  _addCone(r, h, x, y, z, color, flip = false) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    m.position.set(x, y, z);
    if (flip) m.rotation.x = Math.PI;
    m.castShadow = true;
    this.group.add(m);
    return m;
  }

  // Salle des machines : machines à glace + comptoir de cornets.
  // La salle 'machines2' porte en plus la machine sur laquelle est posée la clé.
  _furnishMachines(ab) {
    const { minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    const iceMachine = (mx, mz, color) => {
      ab(0.9, 1.4, 0.7, mx, 0.7, mz, color);              // corps inox
      ab(0.96, 0.18, 0.76, mx, 1.5, mz, 0xb0bec5);        // capot
      ab(0.12, 0.22, 0.12, mx - 0.2, 0.92, mz + 0.4, 0xcfd8dc); // bec g
      ab(0.12, 0.22, 0.12, mx + 0.2, 0.92, mz + 0.4, 0xcfd8dc); // bec d
      ab(0.74, 0.05, 0.32, mx, 0.56, mz + 0.42, 0x607d8b); // bac d'égouttage
      // Glace à l'italienne qui sort du bec.
      this._addCone(0.12, 0.34, mx, 0.78, mz + 0.42, 0xfff8e1, true);
    };

    iceMachine(cx - 2.8, minZ + 0.7, 0xeceff1);
    iceMachine(cx + 2.8, minZ + 0.7, 0xeceff1);

    // Comptoir + cornets empilés.
    ab(2.4, 0.85, 0.6, cx, 0.42, maxZ - 0.7, 0xb0855a);
    for (let i = 0; i < 4; i++) {
      const x = cx - 0.9 + i * 0.6;
      this._addCone(0.14, 0.4, x, 1.05, maxZ - 0.7, 0xd7a86e, false); // cornet
      this._addCyl(0.13, 0.13, 0.14, x, 1.3, maxZ - 0.7, 0xfff3e0);   // boule de glace
    }

    // Machine porteuse de la clé (salle machines2, alignée sur keyPosition).
    if (this.name === 'machines2') {
      ab(0.9, 1.0, 0.7, 6, 0.5, 14, 0x42a5f5);     // corps bleu mis en avant
      ab(0.98, 0.12, 0.78, 6, 1.0, 14, 0xb0bec5);  // plateau (la clé flotte au-dessus)
      ab(0.14, 0.24, 0.14, 6, 0.78, 14.45, 0xcfd8dc);
    }
  }

  // Salle dangereuse : broyeurs industriels (décor uniquement).
  _furnishBroyeur(ab) {
    const { minX, maxX, minZ } = this.def;
    const cx = this.cx, cz = this.cz;

    const broyeur = (mx, mz) => {
      ab(1.7, 0.12, 1.5, mx, 0.06, mz, 0xffb300);  // socle jaune (danger)
      ab(1.5, 1.1, 1.3, mx, 0.67, mz, 0x546e7a);   // corps métal
      ab(1.3, 0.45, 1.1, mx, 1.4, mz, 0x37474f);   // trémie
      // Bandes de danger (jaune).
      ab(1.54, 0.16, 0.06, mx, 0.55, mz + 0.66, 0xffca28);
      ab(1.54, 0.16, 0.06, mx, 0.9, mz + 0.66, 0xffca28);
      // Lame visible dans la trémie.
      this._addCyl(0.5, 0.5, 0.08, mx, 1.18, mz, 0x90a4ae, 0.3);
    };

    // La salle du boss garde de l'espace : un seul broyeur dans un coin.
    if (this.name === 'dangereuse3') {
      broyeur(minX + 1.6, minZ + 1.6);
    } else {
      broyeur(cx - 2.2, minZ + 1.8);
      broyeur(cx + 2.2, minZ + 1.8);
      ab(0.3, 1.1, maxX - minX - 1.5, maxX - 0.4, 0.55, cz, 0x455a64); // convoyeur mural
    }
  }

  // Salle sucrée : conteneurs de sucre + cannes à sucre.
  _furnishSucree(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Conteneurs de sucre empilés.
    ab(1.1, 1.0, 1.1, minX + 1.3, 0.5, minZ + 1.4, 0xfff8e1);
    ab(1.1, 1.0, 1.1, minX + 2.6, 0.5, minZ + 1.4, 0xffecb3);
    ab(1.1, 0.9, 1.1, minX + 1.3, 1.45, minZ + 1.4, 0xfff3e0); // empilé
    // Petit tas de sucre versé (cône blanc).
    this._addCone(0.5, 0.5, minX + 2.6, 1.25, minZ + 1.4, 0xfafafa, false);

    // Sacs de sucre côté est.
    ab(0.9, 0.6, 0.7, maxX - 0.9, 0.3, minZ + 1.0, 0xf5f5dc);
    ab(0.9, 0.6, 0.7, maxX - 0.9, 0.3, minZ + 1.9, 0xeee8aa);

    // Cannes à sucre (tiges segmentées vert/jaune) dans un bac.
    ab(1.4, 0.4, 0.8, cx, 0.2, maxZ - 1.0, 0x6d4c41); // bac
    for (let i = 0; i < 6; i++) {
      const x = cx - 0.5 + (i % 3) * 0.5;
      const z = maxZ - 1.2 + Math.floor(i / 3) * 0.4;
      const tilt = (i - 3) * 0.05;
      const stalk = this._addCyl(0.05, 0.06, 1.7, x, 1.05, z,
        i % 2 ? 0x9ccc65 : 0xcddc39);
      stalk.rotation.z = tilt;
    }
  }

  // Salle de pause : table, bancs, distributeur, machine à café.
  _furnishPause(ab) {
    const { minX, maxX, minZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Table à l'écart du point de spawn (vers le nord de la pièce).
    const tz = cz + 3;
    ab(1.9, 0.06, 0.9, cx, 0.75, tz, 0xd7ccc8);
    ab(0.07, 0.72, 0.07, cx - 0.85, 0.38, tz - 0.35, 0x8d6e63);
    ab(0.07, 0.72, 0.07, cx + 0.85, 0.38, tz - 0.35, 0x8d6e63);
    ab(0.07, 0.72, 0.07, cx - 0.85, 0.38, tz + 0.35, 0x8d6e63);
    ab(0.07, 0.72, 0.07, cx + 0.85, 0.38, tz + 0.35, 0x8d6e63);
    // Bancs.
    ab(1.9, 0.12, 0.4, cx, 0.42, tz - 0.85, 0x8d6e63);
    ab(1.9, 0.12, 0.4, cx, 0.42, tz + 0.85, 0x8d6e63);
    // Tasses sur la table.
    this._addCyl(0.07, 0.06, 0.12, cx - 0.5, 0.84, tz, 0xffffff);
    this._addCyl(0.07, 0.06, 0.12, cx + 0.4, 0.84, tz - 0.2, 0xef9a9a);

    // Distributeur (machine rouge) dans un coin.
    ab(0.9, 1.9, 0.7, minX + 0.7, 0.95, minZ + 0.7, 0xc62828);
    ab(0.66, 1.1, 0.05, minX + 0.7, 1.2, minZ + 0.36, 0x101418); // vitrine

    // Machine à café.
    ab(0.55, 0.45, 0.4, maxX - 0.6, 1.05, minZ + 0.6, 0x37474f);
    ab(0.55, 0.6, 0.4, maxX - 0.6, 0.5, minZ + 0.6, 0x546e7a); // meuble support
  }

  // Toilettes (niveau 2) : décor sanitaire, calqué sur le niveau 1.
  _furnishToilet(ab) {
    const { minZ, maxX, maxZ } = this.def;
    const cx = this.cx;
    const twcx = cx + 2;
    const twcz = maxZ - 0.9;
    ab(0.68, 0.44, 0.78, twcx, 0.22, twcz, 0xf0f4f8);          // cuvette
    ab(0.62, 0.06, 0.70, twcx, 0.47, twcz, 0xffffff);          // abattant
    ab(0.60, 0.28, 0.22, twcx, 0.56, maxZ - 0.22, 0xf0f4f8);   // réservoir
    ab(0.12, 0.06, 0.12, twcx, 0.71, maxZ - 0.14, 0xb0bec5);   // bouton
    ab(0.62, 0.22, 0.46, maxX - 1.1, 0.84, minZ + 0.4, 0xffffff); // lavabo
    ab(0.08, 0.76, 0.08, maxX - 0.88, 0.38, minZ + 0.36, 0xb0bec5);
    ab(0.08, 0.76, 0.08, maxX - 1.32, 0.38, minZ + 0.36, 0xb0bec5);
    ab(0.06, 0.68, 0.58, maxX - 0.06, 1.38, minZ + 0.5, 0xb0bec5); // miroir
    ab(0.16, 0.16, 0.16, twcx + 0.52, 0.70, twcz - 0.28, 0xfafafa); // PQ
  }

  // ---------------------------------------------------------------
  //  NIVEAU 3 — L'école
  // ---------------------------------------------------------------

  // Salle de classe : tableau, estrade + bureau du maître, 6 pupitres, casiers.
  _furnishClasse(ab) {
    const { minX, maxX, minZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Tableau noir + cadre en bois sur le mur nord.
    ab(6.4, 1.9, 0.1, cx, 1.75, minZ + 0.2, 0x6d4c41);   // cadre
    ab(6.0, 1.6, 0.06, cx, 1.75, minZ + 0.27, 0x25402f); // ardoise
    ab(6.0, 0.12, 0.16, cx, 0.9, minZ + 0.3, 0x8d6e63);  // tablette à craies

    // Estrade + bureau du maître.
    ab(4.4, 0.12, 1.8, cx, 0.06, minZ + 1.9, 0x9e7b5a);
    ab(1.9, 0.08, 0.85, cx, 0.86, minZ + 1.9, 0xa1887f);
    for (const [ox, oz] of [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]]) {
      ab(0.08, 0.74, 0.08, cx + ox, 0.49, minZ + 1.9 + oz, 0x795548);
    }
    ab(0.5, 0.3, 0.35, cx + 0.6, 1.05, minZ + 1.9, 0xef5350); // pile de cahiers

    // 6 pupitres (2 rangées de 3) tournés vers le tableau.
    const pupitre = (px, pz) => {
      ab(1.1, 0.06, 0.6, px, 0.7, pz, 0xd7b98a);          // plateau
      ab(0.07, 0.66, 0.07, px - 0.48, 0.35, pz - 0.22, 0x8d6e63);
      ab(0.07, 0.66, 0.07, px + 0.48, 0.35, pz - 0.22, 0x8d6e63);
      ab(0.07, 0.66, 0.07, px - 0.48, 0.35, pz + 0.22, 0x8d6e63);
      ab(0.07, 0.66, 0.07, px + 0.48, 0.35, pz + 0.22, 0x8d6e63);
      ab(0.5, 0.06, 0.45, px, 0.42, pz + 0.75, 0x42a5f5);  // assise de la chaise
      ab(0.5, 0.5, 0.06, px, 0.7, pz + 0.98, 0x1e88e5);    // dossier
      ab(0.05, 0.4, 0.05, px - 0.2, 0.21, pz + 0.62, 0x90a4ae);
      ab(0.05, 0.4, 0.05, px + 0.2, 0.21, pz + 0.62, 0x90a4ae);
      ab(0.22, 0.02, 0.3, px, 0.74, pz, 0xfafafa);         // cahier ouvert
    };
    for (const rz of [cz - 0.4, cz + 2.6]) {
      for (const rx of [cx - 2.7, cx, cx + 2.7]) pupitre(rx, rz);
    }

    // Casiers muraux + affiches colorées.
    ab(0.4, 1.5, 5.0, maxX - 0.3, 0.75, cz + 1, 0xbcaaa4);
    for (let i = 0; i < 4; i++) {
      ab(0.42, 0.06, 5.0, maxX - 0.3, 0.4 + i * 0.35, cz + 1, 0x8d6e63); // séparations
    }
    const affiches = [0xef5350, 0xffee58, 0x66bb6a, 0x42a5f5];
    for (let i = 0; i < 4; i++) {
      ab(0.04, 0.8, 0.6, minX + 0.15, 1.9, cz - 2 + i * 1.6, affiches[i]);
    }

    // Globe terrestre sur un petit meuble, près du bureau.
    ab(0.5, 0.9, 0.5, minX + 1.0, 0.45, minZ + 1.2, 0x795548);
    this._addCyl(0.03, 0.03, 0.5, minX + 1.0, 1.15, minZ + 1.2, 0xb0bec5);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2196f3, roughness: 0.6 })
    );
    globe.position.set(minX + 1.0, 1.36, minZ + 1.2);
    globe.rotation.z = 0.4;
    this.group.add(globe);
  }

  // Salle des maîtres : grande table de réunion (porteuse de la clé), café,
  // armoire à dossiers, canapé.
  _furnishSalleMaitres(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx;

    // Table de réunion — le plateau est aligné sur keyPosition (0, 1.05, -20),
    // la clé flotte juste au-dessus (même principe que la machine de machines2).
    ab(3.4, 0.1, 1.6, 0, 0.95, -20, 0x8d6e63);
    for (const [ox, oz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]]) {
      ab(0.12, 0.9, 0.12, ox, 0.45, -20 + oz, 0x6d4c41);
    }
    // 4 chaises autour.
    for (const [sx, sz] of [[-1.1, -1.3], [1.1, -1.3], [-1.1, 1.3], [1.1, 1.3]]) {
      ab(0.5, 0.06, 0.5, sx, 0.46, -20 + sz, 0x546e7a);
      ab(0.5, 0.55, 0.06, sx, 0.76, -20 + sz + (sz < 0 ? -0.24 : 0.24), 0x455a64);
    }
    // Tasses + dossiers sur la table.
    this._addCyl(0.06, 0.05, 0.11, -0.7, 1.06, -20.3, 0xffffff);
    this._addCyl(0.06, 0.05, 0.11, 0.8, 1.06, -19.7, 0xef9a9a);
    ab(0.3, 0.05, 0.4, -1.2, 1.02, -19.8, 0xfff59d);

    // Machine à café + plan de travail.
    ab(1.6, 0.9, 0.6, minX + 1.1, 0.45, minZ + 0.6, 0xb0bec5);
    ab(0.5, 0.5, 0.4, minX + 1.1, 1.15, minZ + 0.6, 0x37474f);
    this._addCyl(0.08, 0.08, 0.2, minX + 1.5, 1.0, minZ + 0.7, 0xffffff);

    // Armoire à dossiers.
    ab(1.2, 2.0, 0.6, maxX - 1.0, 1.0, minZ + 0.5, 0x78909c);
    for (let i = 0; i < 4; i++) {
      ab(1.1, 0.05, 0.05, maxX - 1.0, 0.4 + i * 0.48, minZ + 0.22, 0x455a64);
    }

    // Canapé du fond.
    ab(2.6, 0.4, 0.9, cx, 0.2, maxZ - 1.0, 0x5d4037);
    ab(2.6, 0.6, 0.25, cx, 0.6, maxZ - 0.6, 0x6d4c41);
    ab(0.25, 0.5, 0.9, cx - 1.3, 0.55, maxZ - 1.0, 0x6d4c41);
    ab(0.25, 0.5, 0.9, cx + 1.3, 0.55, maxZ - 1.0, 0x6d4c41);
  }

  // Salle d'activité : tapis de motricité, bacs à jouets, chevalets, cubes.
  _furnishSalleActivite(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Tapis de motricité colorés (damier 2×2).
    const tapis = [0xef5350, 0xffee58, 0x66bb6a, 0x42a5f5];
    for (let i = 0; i < 4; i++) {
      ab(2.0, 0.04, 2.0, cx - 1.1 + (i % 2) * 2.2, 0.02, cz + 1 - Math.floor(i / 2) * 2.2, tapis[i]);
    }

    // Bacs à jouets alignés au mur nord.
    for (let i = 0; i < 3; i++) {
      const bx = minX + 2.0 + i * 2.2;
      ab(1.4, 0.5, 0.9, bx, 0.25, minZ + 0.8, 0xffb74d);
      ab(1.2, 0.06, 0.7, bx, 0.52, minZ + 0.8, 0xffe0b2);
      // Quelques jouets qui dépassent.
      ab(0.25, 0.25, 0.25, bx - 0.3, 0.62, minZ + 0.8, tapis[i]);
      this._addCyl(0.14, 0.14, 0.2, bx + 0.3, 0.6, minZ + 0.8, tapis[(i + 1) % 4]);
    }

    // 2 chevalets de peinture (trépied + plateau).
    for (const ex of [maxX - 1.6, maxX - 3.6]) {
      ab(0.08, 1.5, 0.08, ex - 0.4, 0.75, minZ + 3.0, 0xa1887f);
      ab(0.08, 1.5, 0.08, ex + 0.4, 0.75, minZ + 3.0, 0xa1887f);
      ab(0.08, 1.5, 0.08, ex, 0.75, minZ + 3.5, 0xa1887f);
      ab(1.0, 1.0, 0.06, ex, 1.2, minZ + 3.0, 0xfafafa);   // feuille
      ab(1.05, 0.1, 0.16, ex, 0.66, minZ + 2.95, 0x8d6e63); // porte-pinceaux
    }

    // Tour de cubes empilés.
    for (let i = 0; i < 4; i++) {
      ab(0.5, 0.5, 0.5, minX + 1.4, 0.25 + i * 0.5, maxZ - 1.4, tapis[i]);
    }

    // Tableau d'activités.
    ab(3.0, 1.4, 0.08, cx + 1, 1.8, maxZ - 0.15, 0xfff8e1);
    ab(3.2, 0.12, 0.12, cx + 1, 2.55, maxZ - 0.2, 0x8d6e63);
  }

  // Dortoir : 6 petits lits en 2 rangées, chevets, veilleuse.
  _furnishDortoir(ab) {
    const { minX, maxX, minZ } = this.def;
    const cx = this.cx;

    const couvertures = [0xef9a9a, 0xa5d6a7, 0x90caf9, 0xffcc80, 0xce93d8, 0x80deea];
    const lit = (lx, lz, color) => {
      ab(1.0, 0.28, 2.0, lx, 0.14, lz, 0x8d6e63);          // sommier
      ab(0.95, 0.16, 1.9, lx, 0.36, lz, 0xfafafa);         // matelas
      ab(0.95, 0.12, 1.2, lx, 0.5, lz + 0.3, color);       // couverture
      ab(0.6, 0.12, 0.32, lx, 0.5, lz - 0.72, 0xffffff);   // oreiller
      ab(1.05, 0.6, 0.1, lx, 0.5, lz - 1.0, 0x795548);     // tête de lit
    };

    // Rangée ouest et rangée est, tête contre les murs latéraux.
    for (let i = 0; i < 3; i++) {
      const lz = minZ + 2.2 + i * 3.2;
      lit(minX + 1.4, lz, couvertures[i]);
      lit(maxX - 1.4, lz, couvertures[i + 3]);
    }

    // Tables de chevet entre les lits.
    for (let i = 0; i < 2; i++) {
      const nz = minZ + 3.8 + i * 3.2;
      ab(0.6, 0.5, 0.5, minX + 1.4, 0.25, nz, 0xa1887f);
      ab(0.6, 0.5, 0.5, maxX - 1.4, 0.25, nz, 0xa1887f);
    }

    // Veilleuse au centre (lampe + halo doux).
    this._addCyl(0.18, 0.26, 0.4, cx, 0.5, minZ + 1.2, 0xfff59d);
    ab(0.5, 0.3, 0.5, cx, 0.15, minZ + 1.2, 0x8d6e63);
    const veilleuse = new THREE.PointLight(0xffe082, 0.5, 7);
    veilleuse.position.set(cx, 0.9, minZ + 1.2);
    this.group.add(veilleuse);

    // Tapis central.
    ab(3.0, 0.04, 6.0, cx, 0.02, this.cz, 0x7986cb);
  }

  // Cour de récréation : 2 balançoires, 3 bancs, terrain de foot avec cages.
  // Coordonnées en monde (la cour va de X −18..18 / Z 0..20).
  _furnishCour(ab) {
    // --- Terrain de foot : pelouse + marquages ---
    ab(15, 0.04, 14, 8.5, 0.02, 11, 0x4c8c3f);              // pelouse
    const ligne = (w, d, x, z) => ab(w, 0.02, d, x, 0.05, z, 0xf5f5f5);
    ligne(14.2, 0.14, 8.5, 4.4);    // ligne de but nord
    ligne(14.2, 0.14, 8.5, 17.6);   // ligne de but sud
    ligne(0.14, 13.4, 1.4, 11);     // touche ouest
    ligne(0.14, 13.4, 15.6, 11);    // touche est
    ligne(14.2, 0.14, 8.5, 11);     // ligne médiane
    // Rond central (12 segments).
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ab(0.5, 0.02, 0.16, 8.5 + Math.cos(a) * 2.0, 0.05, 11 + Math.sin(a) * 2.0, 0xf5f5f5);
    }

    // --- 2 cages (poteaux + barre + filet suggéré) ---
    const cage = (gz, back) => {
      ab(0.14, 2.0, 0.14, 6.7, 1.0, gz, 0xfafafa);          // poteau gauche
      ab(0.14, 2.0, 0.14, 10.3, 1.0, gz, 0xfafafa);         // poteau droit
      ab(3.74, 0.14, 0.14, 8.5, 2.0, gz, 0xfafafa);         // barre transversale
      // Filet : barres verticales fines en retrait.
      for (let i = 0; i < 5; i++) {
        ab(0.05, 1.9, 0.05, 7.0 + i * 0.75, 0.95, gz + back * 0.7, 0xe0e0e0);
      }
      ab(3.6, 0.05, 0.05, 8.5, 1.9, gz + back * 0.7, 0xe0e0e0);
    };
    cage(4.6, -1);
    cage(17.4, 1);

    // Ballon posé sur le rond central.
    const ballon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 })
    );
    ballon.position.set(8.5, 0.24, 11);
    this.group.add(ballon);

    // --- 2 balançoires (portique en A + chaînes + assise) ---
    const balancoire = (bz) => {
      // 4 montants inclinés formant deux A.
      for (const dz of [-0.9, 0.9]) {
        for (const dx of [-1.1, 1.1]) {
          const m = this._addCyl(0.07, 0.09, 2.6, -14.5 + dx, 1.25, bz + dz, 0x546e7a, 0.5);
          m.rotation.z = dx > 0 ? -0.22 : 0.22;
          m.rotation.x = dz > 0 ? -0.18 : 0.18;
        }
      }
      // Barre transversale.
      const barre = this._addCyl(0.08, 0.08, 2.4, -14.5, 2.42, bz, 0x455a64, 0.5);
      barre.rotation.x = Math.PI / 2;
      // 2 chaînes + assise.
      this._addCyl(0.022, 0.022, 1.55, -14.9, 1.63, bz, 0xb0bec5, 0.3);
      this._addCyl(0.022, 0.022, 1.55, -14.1, 1.63, bz, 0xb0bec5, 0.3);
      ab(1.0, 0.08, 0.34, -14.5, 0.86, bz, 0xd84315);
    };
    balancoire(5);
    balancoire(9.5);

    // --- 3 bancs (assise + dossier + piètements) ---
    const banc = (bx, bz) => {
      ab(2.0, 0.1, 0.5, bx, 0.45, bz, 0x8d6e63);            // assise
      ab(2.0, 0.55, 0.1, bx, 0.75, bz - 0.22, 0x795548);    // dossier
      ab(0.12, 0.42, 0.5, bx - 0.85, 0.21, bz, 0x455a64);
      ab(0.12, 0.42, 0.5, bx + 0.85, 0.21, bz, 0x455a64);
    };
    banc(-9, 2.2);
    banc(-2, 2.2);
    banc(-15, 15);

    // --- Marelle peinte près des bancs ---
    for (let i = 0; i < 5; i++) {
      ab(1.0, 0.02, 1.0, -6.5, 0.04, 5.5 + i * 1.1, i % 2 ? 0xf5f5f5 : 0xffe082);
    }

    // Quelques arbustes en pot le long du mur d'enceinte sud.
    for (const px of [-16, -11, 12, 16.5]) {
      ab(0.7, 0.5, 0.7, px, 0.25, 18.8, 0x8d6e63);
      this._addCone(0.55, 1.3, px, 1.15, 18.8, 0x388e3c, false);
    }
  }

  // =====================================================================
  // NIVEAU 4 — L'usine de robots
  // =====================================================================

  // Panneau de texte plaqué sur un mur (canvas). rotY : 0 = face +Z (mur nord),
  // PI = face -Z (mur sud), -PI/2 = face -X (mur est), PI/2 = face +X (mur ouest).
  _sign(text, w, h, x, y, z, rotY, bg = '#263238', fg = '#ffeb3b') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * h) / w);
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = fg;
    g.lineWidth = 8;
    g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(c.height * 0.42)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.group.add(m);
    return m;
  }

  // Boîte lumineuse (écran, voyant) insensible à l'éclairage.
  _glow(w, h, d, x, y, z, color) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color })
    );
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  // Chaîne de construction : 2 tapis roulants (z = centre ± 3) sur lesquels
  // sont postés les robots (spawns). Pièces qui défilent, bras de portique.
  _furnishConstruction(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    const belts = [];
    for (const bz of [cz - 3, cz + 3]) {
      ab(9.6, 0.5, 1.3, cx, 0.27, bz, 0x37474f);            // châssis
      ab(9.2, 0.03, 1.0, cx, 0.545, bz, 0x212121);          // bande
      ab(9.6, 0.1, 0.1, cx, 0.58, bz - 0.62, 0xffc107);     // rails jaunes
      ab(9.6, 0.1, 0.1, cx, 0.58, bz + 0.62, 0xffc107);

      // Portique aérien + bras de soudure.
      ab(0.2, 2.75, 0.2, cx - 4.6, 1.37, bz - 0.9, 0x546e7a);
      ab(0.2, 2.75, 0.2, cx + 4.6, 1.37, bz - 0.9, 0x546e7a);
      ab(9.6, 0.18, 0.3, cx, 2.75, bz - 0.9, 0xff8f00);
      for (const ax of [-1.5, 1.5]) {
        this._addCyl(0.07, 0.07, 0.9, cx + ax, 2.25, bz - 0.9, 0xff8f00);
        ab(0.18, 0.18, 0.3, cx + ax, 1.72, bz - 0.8, 0x263238);
        this._glow(0.08, 0.08, 0.08, cx + ax, 1.6, bz - 0.7, 0xffeb3b);
      }

      // Pièces qui défilent sur la bande.
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.2, 0.28),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0xef6c00 : 0x90a4ae, roughness: 0.5, metalness: 0.5 })
        );
        p.position.set(cx, 0.66, bz + 0.3);
        this.group.add(p);
        parts.push(p);
      }
      belts.push({ bz, parts });
    }
    this.animators.push((delta, time) => {
      for (const b of belts) {
        b.parts.forEach((p, i) => {
          p.position.x = cx - 4.4 + ((time * 0.9 + i * 1.76) % 8.8);
        });
      }
    });

    // Caisses de pièces dans les coins.
    ab(1.0, 1.0, 1.0, minX + 0.9, 0.5, minZ + 0.9, 0x8d6e63);
    ab(0.8, 0.8, 0.8, minX + 0.9, 1.4, minZ + 0.9, 0xa1887f);
    ab(1.0, 0.9, 1.0, maxX - 0.9, 0.45, maxZ - 0.9, 0x8d6e63);
    ab(1.0, 0.7, 1.0, minX + 0.9, 0.35, maxZ - 0.9, 0x6d4c41);

    // Panneau de la chaîne (mur nord, décalé pour ne pas masquer la porte).
    this._sign(`CHAÎNE ${this.name.slice(-1)}`, 2.4, 0.7, cx + 4.2, 2.3, minZ + 0.2, 0);
  }

  // Salle de test : plaque de test, mannequin, pendule d'impact, console.
  _furnishTest(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Plaque de test + bandes de danger.
    ab(4, 0.03, 4, cx, 0.02, cz, 0x263238);
    for (let i = 0; i < 5; i++) {
      ab(0.3, 0.04, 4, cx - 1.8 + i * 0.9, 0.03, cz, i % 2 ? 0x212121 : 0xffc107);
    }

    // Mannequin de crash-test.
    this._addCyl(0.14, 0.14, 0.7, cx, 0.4, cz, 0xffb300);
    this._addCyl(0.2, 0.18, 0.6, cx, 1.05, cz, 0xfafafa);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.6 })
    );
    head.position.set(cx, 1.52, cz);
    this.group.add(head);

    // Pendule d'impact suspendu au plafond.
    const pivot = new THREE.Group();
    pivot.position.set(cx, 3.0, cz - 2.4);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.7, roughness: 0.3 })
    );
    rod.position.y = -1.0;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.8, roughness: 0.3 })
    );
    ball.position.y = -2.0;
    pivot.add(rod, ball);
    this.group.add(pivot);
    this.animators.push((delta, time) => { pivot.rotation.z = Math.sin(time * 1.6) * 0.8; });

    // Console de contrôle sur le mur opposé à l'entrée.
    const west = this.name === 'test1';
    const wx = west ? minX + 0.6 : maxX - 0.6;
    ab(0.7, 0.9, 3.2, wx, 0.45, cz, 0x455a64);
    ab(0.5, 0.5, 3.0, wx + (west ? 0.12 : -0.12), 1.15, cz, 0x37474f);
    const dir = west ? 1 : -1;
    this._glow(0.04, 0.34, 1.2, wx + dir * 0.4, 1.2, cz - 0.7, 0x4fc3f7);
    this._glow(0.04, 0.34, 1.2, wx + dir * 0.4, 1.2, cz + 0.7, 0x69f0ae);
    this._sign(`TEST ${this.name.slice(-1)}`, 2.0, 0.6, west ? minX + 0.2 : maxX - 0.2, 2.3, cz,
      west ? Math.PI / 2 : -Math.PI / 2);
  }

  // Salle de préparation : établis, berceau d'assemblage, étagères de têtes.
  _furnishPreparation(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    const bench = (x, z) => {
      ab(2.4, 0.9, 1.0, x, 0.45, z, 0x546e7a);
      ab(2.5, 0.06, 1.1, x, 0.93, z, 0xcfd8dc);
      ab(0.3, 0.2, 0.3, x - 0.6, 1.06, z, 0xff8f00);   // pièce en cours
      ab(0.4, 0.1, 0.2, x + 0.5, 0.99, z, 0x263238);   // outil
      this._glow(0.2, 0.05, 0.2, x + 0.1, 0.98, z, 0x69f0ae);
    };
    bench(cx - 4.2, cz - 4.5);
    bench(cx + 4.2, cz + 4.5);

    // Berceau d'assemblage : robot à moitié monté.
    ab(1.2, 0.2, 1.2, cx, 0.1, cz - 1.5, 0x37474f);
    ab(0.6, 0.7, 0.4, cx, 0.65, cz - 1.5, 0x90a4ae);
    ab(0.34, 0.26, 0.3, cx, 1.14, cz - 1.5, 0x78909c);
    this._glow(0.24, 0.06, 0.04, cx, 1.16, cz - 1.34, 0x4fc3f7);
    ab(0.1, 0.7, 0.1, cx - 0.5, 0.7, cz - 1.5, 0xff8f00);   // montants
    ab(0.1, 0.7, 0.1, cx + 0.5, 0.7, cz - 1.5, 0xff8f00);

    // Étagères de têtes de robots le long du mur ouest et est.
    for (const side of [-1, 1]) {
      const sx = side < 0 ? minX + 0.5 : maxX - 0.5;
      for (const sz of [cz - 3.5, cz + 3.5]) {
        ab(0.5, 2.0, 2.4, sx, 1.0, sz, 0x455a64);
        for (const sy of [0.5, 1.0, 1.5]) {
          ab(0.55, 0.05, 2.45, sx, sy, sz, 0x78909c);
          for (let k = 0; k < 3; k++) {
            ab(0.25, 0.22, 0.25, sx, sy + 0.14, sz - 0.75 + k * 0.75, k % 2 ? 0xb0bec5 : 0x90a4ae);
            this._glow(0.14, 0.04, 0.03, sx - side * 0.13, sy + 0.16, sz - 0.75 + k * 0.75, 0x4fc3f7);
          }
        }
      }
    }

    this._sign('PRÉPARATION', 3.0, 0.7, cx + 3.6, 2.3, minZ + 0.2, 0);
  }

  // Entrepôt : étagères, palettes, caisses. La caisse centrale porte la clé.
  _furnishEntrepot(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    const shelf = (x, z, alongZ, len) => {
      const w = alongZ ? 0.6 : len, d = alongZ ? len : 0.6;
      for (const sy of [0.05, 0.8, 1.55, 2.3]) ab(w, 0.06, d, x, sy, z, 0x546e7a);
      const n = Math.floor(len / 1.8) + 1;
      for (let i = 0; i <= n; i++) {
        const o = -len / 2 + (len * i) / n;
        ab(0.08, 2.35, 0.08, alongZ ? x - 0.26 : x + o, 1.17, alongZ ? z + o : z - 0.26, 0x37474f);
        ab(0.08, 2.35, 0.08, alongZ ? x + 0.26 : x + o, 1.17, alongZ ? z + o : z + 0.26, 0x37474f);
      }
      // Cartons sur les étagères.
      const cols = [0xa1887f, 0x8d6e63, 0xbcaaa4];
      for (const sy of [0.4, 1.15, 1.9]) {
        const k = Math.floor(len / 1.1);
        for (let i = 0; i < k; i++) {
          const o = -len / 2 + 0.55 + i * 1.1;
          ab(alongZ ? 0.45 : 0.8, 0.6, alongZ ? 0.8 : 0.45,
            alongZ ? x : x + o, sy, alongZ ? z + o : z, cols[(i + Math.round(sy * 3)) % 3]);
        }
      }
    };
    shelf(minX + 0.6, cz - 3.2, true, 4.4);     // mur ouest
    shelf(minX + 0.6, cz + 3.4, true, 4.4);
    shelf(cx - 1.5, maxZ - 0.5, false, 5.4);    // mur sud

    // Caisse centrale (porte la clé, alignée sur keyPosition) + palette.
    ab(1.4, 0.12, 1.4, cx, 0.06, cz, 0xa1887f);
    ab(1.1, 0.78, 1.1, cx, 0.51, cz, 0x8d6e63);
    ab(1.18, 0.08, 1.18, cx, 0.94, cz, 0x6d4c41);

    // Piles de caisses (coin nord-est, loin du couloir de la porte nord).
    ab(1.0, 1.0, 1.0, maxX - 0.8, 0.5, minZ + 0.8, 0x8d6e63);
    ab(1.0, 1.0, 1.0, maxX - 1.9, 0.5, minZ + 0.8, 0xa1887f);
    ab(0.9, 0.9, 0.9, maxX - 1.3, 1.45, minZ + 0.8, 0x6d4c41);
    // Transpalette.
    ab(0.5, 0.1, 1.6, cx + 2.8, 0.2, cz + 3.0, 0xffb300);
    ab(0.05, 1.0, 0.05, cx + 2.8, 0.7, cz + 2.2, 0x263238);

    this._sign('ENTREPÔT', 2.6, 0.7, minX + 0.2, 2.5, cz + 0.2, Math.PI / 2);
  }

  // Grand hall d'entrée : logo, comptoir d'accueil, statue de robot.
  _furnishHallUsine(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx;

    // Tapis central.
    ab(3, 0.02, 7, cx, 0.02, maxZ - 5.5, 0x37474f);
    ab(0.2, 0.025, 7, cx - 1.2, 0.03, maxZ - 5.5, 0xffc107);
    ab(0.2, 0.025, 7, cx + 1.2, 0.03, maxZ - 5.5, 0xffc107);

    // Comptoir d'accueil + logo.
    ab(4.2, 1.0, 0.8, cx, 0.5, maxZ - 1.0, 0x546e7a);
    ab(4.3, 0.06, 0.9, cx, 1.03, maxZ - 1.0, 0xeceff1);
    this._glow(0.5, 0.3, 0.04, cx - 1.2, 1.35, maxZ - 1.0, 0x4fc3f7);
    this._sign('ROBOTECH', 5.0, 1.2, cx, 2.0, maxZ - 0.2, Math.PI);

    // Statue de robot géant (coin nord-est).
    const sx = maxX - 1.3, sz = minZ + 1.3;
    ab(1.1, 0.3, 1.1, sx, 0.15, sz, 0x37474f);
    ab(0.35, 0.9, 0.35, sx - 0.2, 0.75, sz, 0x90a4ae);
    ab(0.35, 0.9, 0.35, sx + 0.2, 0.75, sz, 0x90a4ae);
    ab(0.9, 0.9, 0.5, sx, 1.65, sz, 0xb0bec5);
    ab(0.5, 0.45, 0.4, sx, 2.3, sz, 0x90a4ae);
    this._glow(0.36, 0.08, 0.04, sx, 2.32, sz + 0.21, 0x4fc3f7);
    ab(0.22, 0.8, 0.22, sx - 0.65, 1.6, sz, 0x78909c);
    ab(0.22, 0.8, 0.22, sx + 0.65, 1.6, sz, 0x78909c);

    // Bancs d'attente le long du mur ouest.
    for (const bz of [minZ + 3.2, minZ + 9]) {
      ab(0.5, 0.1, 1.8, minX + 0.6, 0.45, bz, 0x8d6e63);
      ab(0.1, 0.45, 1.8, minX + 0.3, 0.7, bz, 0x6d4c41);
    }
    // Plantes en pot.
    for (const [px, pz] of [[maxX - 0.7, maxZ - 0.8], [minX + 0.7, maxZ - 0.8]]) {
      ab(0.5, 0.45, 0.5, px, 0.22, pz, 0x8d6e63);
      this._addCone(0.45, 1.1, px, 1.0, pz, 0x2e7d32, false);
    }
  }

  // Chambre froide du boss : piliers de glace, stalactites, congélateurs.
  _furnishArene(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    const cx = this.cx, cz = this.cz;

    // Plaques de glace au sol.
    const iceMat = (op) => new THREE.MeshStandardMaterial({
      color: 0xCFEFFF, roughness: 0.08, metalness: 0.1, transparent: true, opacity: op,
    });
    for (const [x, z, w, d] of [[-4, -44, 5, 3], [5, -48, 6, 4], [-7, -50, 4, 3], [2, -40, 4, 2.5]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), iceMat(0.7));
      m.position.set(x, 0.03, z);
      this.group.add(m);
    }

    // Piliers de glace aux quatre coins de l'arène.
    for (const [px, pz] of [[-8.5, -40.5], [8.5, -40.5], [-8.5, -49.5], [8.5, -49.5]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 3.0, 10), iceMat(0.8));
      p.position.set(px, 1.5, pz);
      this.group.add(p);
    }

    // Stalactites au plafond (déterministes).
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const x = minX + 1 + rnd() * (maxX - minX - 2);
      const z = minZ + 1 + rnd() * (maxZ - minZ - 2);
      const h = 0.5 + rnd() * 0.9;
      this._addCone(0.1 + rnd() * 0.1, h, x, 3.0 - h / 2, z, 0xCFEFFF, true);
    }

    // Congélateurs industriels le long des murs latéraux.
    for (const side of [-1, 1]) {
      const fx = side < 0 ? minX + 0.7 : maxX - 0.7;
      for (const fz of [-49.5, -44, -38.5]) {
        ab(1.2, 1.6, 2.0, fx, 0.8, fz, 0xeceff1);
        ab(1.24, 0.1, 2.04, fx, 1.62, fz, 0x90a4ae);
        this._glow(0.04, 0.12, 0.5, fx - side * 0.62, 1.1, fz - 0.55, 0x4fc3f7);
        ab(0.04, 0.9, 0.06, fx - side * 0.62, 0.9, fz + 0.9, 0x607d8b); // poignée
      }
    }

    // Tuyaux de refroidissement le long du mur nord.
    for (const px of [-9, -6.5, 6.5, 9]) {
      ab(0.2, 3.0, 0.2, px, 1.5, maxZ - 0.3, 0x78909c);
    }
    ab(20, 0.2, 0.2, cx, 2.6, maxZ - 0.3, 0x78909c);

    this._sign('-18°C', 2.4, 0.8, cx + 4, 2.3, minZ + 0.2, 0, '#0d47a1', '#e1f5fe');
    this._sign('CHAMBRE FROIDE', 4.0, 0.8, minX + 0.2, 2.3, cz, Math.PI / 2, '#0d47a1', '#e1f5fe');
  }

  // Salle jungle (victoire) : cascade animée, bassin, arbres, fougères.
  _furnishJungle(ab) {
    const { minX, maxX, minZ, maxZ } = this.def;
    let s = 4242;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

    const POOL = { x: maxX - 5.6, z: -68, r: 3.7 };
    const inPool = (x, z, m = 0) => Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + m;
    const inPath = (x, z) => Math.abs(x) < 2.4 || (z < -79 && x > -9 && x < 3);

    // Clairières d'herbe et sentier de terre.
    for (let i = 0; i < 16; i++) {
      const w = 3 + rnd() * 4, d = 3 + rnd() * 4;
      ab(w, 0.02, d, minX + 2 + rnd() * 26, 0.012, minZ + 2 + rnd() * 26,
        i % 2 ? 0x2E6B2E : 0x4C8F3F);
    }
    ab(2.6, 0.02, 25, 0, 0.025, -66.5, 0x8d6e4b);
    ab(12, 0.02, 4.2, -3, 0.025, -81.5, 0x9a8260);

    // Arbres feuillus.
    const tree = (x, z, h = 1.9, r = 1.2, col = 0x2E7D32) => {
      this._addCyl(0.18, 0.28, h, x, h / 2, z, 0x6D4C41, 0.95);
      for (const [dx, dy, dz, rr] of [[0, 0, 0, r], [0.7, -0.15, 0.3, r * 0.7], [-0.6, -0.1, -0.4, r * 0.75]]) {
        const c = new THREE.Mesh(
          new THREE.SphereGeometry(rr, 10, 8),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 })
        );
        c.scale.y = 0.62;
        c.position.set(x + dx, h + 0.15 + dy, z + dz);
        this.group.add(c);
      }
    };
    // Palmiers.
    const palm = (x, z) => {
      const trunk = this._addCyl(0.12, 0.2, 2.4, x, 1.2, z, 0x8D6E63, 0.95);
      trunk.rotation.z = 0.12;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 1.5, 6),
          new THREE.MeshStandardMaterial({ color: k % 2 ? 0x2E7D32 : 0x43A047, roughness: 0.9 })
        );
        leaf.position.set(x + Math.cos(a) * 0.6, 2.45, z + Math.sin(a) * 0.6);
        leaf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
        this.group.add(leaf);
      }
    };
    for (const [x, z] of [[-12, -58], [-9, -62], [-13, -67], [-10, -73], [-12, -79],
      [-5.5, -63], [-6, -72], [5, -61], [12, -59], [6, -77], [12, -80], [13.5, -75]]) {
      tree(x, z, 1.7 + rnd() * 0.4, 1.0 + rnd() * 0.4, rnd() > 0.5 ? 0x2E7D32 : 0x1B5E20);
    }
    for (const [x, z] of [[-14, -62], [-8, -57], [8.5, -56.5], [-14, -76], [4, -70]]) palm(x, z);

    // Fougères et fleurs.
    for (let i = 0; i < 34; i++) {
      const x = minX + 1 + rnd() * (maxX - minX - 2);
      const z = minZ + 1 + rnd() * (maxZ - minZ - 2);
      if (inPath(x, z) || inPool(x, z, 0.8)) continue;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + rnd();
        const frond = new THREE.Mesh(
          new THREE.ConeGeometry(0.09, 0.85, 5),
          new THREE.MeshStandardMaterial({ color: k % 2 ? 0x388E3C : 0x66BB6A, roughness: 0.95 })
        );
        frond.position.set(x + Math.cos(a) * 0.22, 0.34, z + Math.sin(a) * 0.22);
        frond.rotation.set(Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85);
        this.group.add(frond);
      }
      if (i % 4 === 0) {
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 8),
          new THREE.MeshStandardMaterial({ color: [0xff5252, 0xffeb3b, 0xe040fb][i % 3], roughness: 0.6 })
        );
        f.position.set(x, 0.55, z);
        this.group.add(f);
      }
    }

    // Rochers.
    for (const [x, z, r] of [[-3.5, -60, 0.5], [3.4, -64, 0.6], [-4, -76, 0.45], [3.8, -83, 0.5]]) {
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({ color: 0x78797a, roughness: 1 })
      );
      rock.scale.y = 0.7;
      rock.position.set(x, r * 0.4, z);
      this.group.add(rock);
    }

    // --- Falaise + cascade contre le mur est ---
    ab(2.6, 3.0, 13, maxX - 1.3, 1.5, POOL.z, 0x6f7568);
    ab(2.0, 2.4, 3, maxX - 1.6, 1.2, POOL.z - 7.2, 0x7b8071);
    ab(2.0, 2.0, 3, maxX - 1.6, 1.0, POOL.z + 7.2, 0x7b8071);
    ab(0.8, 0.3, 4.2, maxX - 2.9, 2.85, POOL.z, 0x5d6358); // rebord d'où tombe l'eau

    // Texture d'eau (traînées blanches) qui défile vers le bas.
    const wc = document.createElement('canvas');
    wc.width = 64; wc.height = 256;
    const wg = wc.getContext('2d');
    wg.fillStyle = '#5ec8f5';
    wg.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 46; i++) {
      wg.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`;
      const x = rnd() * 64, y = rnd() * 256, h = 20 + rnd() * 70;
      wg.fillRect(x, y, 1 + rnd() * 3, h);
      if (y + h > 256) wg.fillRect(x, y - 256, 2, h);   // boucle sans couture
    }
    const wtex = new THREE.CanvasTexture(wc);
    wtex.colorSpace = THREE.SRGBColorSpace;
    wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
    wtex.repeat.set(2, 1.2);
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.9),
      new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.9 })
    );
    fall.position.set(maxX - 2.65, 1.45, POOL.z);   // juste devant la falaise (face à x = maxX-2.6)
    fall.rotation.y = -Math.PI / 2;
    this.group.add(fall);

    // Bassin + anneaux d'ondulation.
    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(POOL.r, POOL.r, 0.14, 28),
      new THREE.MeshStandardMaterial({
        color: 0x29B6F6, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.85,
      })
    );
    pool.position.set(POOL.x, 0.07, POOL.z);
    this.group.add(pool);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const st = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.28 + rnd() * 0.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x7d7f7a, roughness: 1 })
      );
      st.scale.y = 0.6;
      st.position.set(POOL.x + Math.cos(a) * (POOL.r + 0.1), 0.12, POOL.z + Math.sin(a) * (POOL.r + 0.1));
      this.group.add(st);
    }
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.03, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(maxX - 3.9, 0.16, POOL.z);
      this.group.add(ring);
      rings.push(ring);
    }

    // Écume + brume au pied de la chute.
    const foam = [];
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + rnd() * 0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
      );
      f.position.set(maxX - 3.1 + rnd() * 0.5, 0.2, POOL.z - 1.6 + (i / 7) * 3.2);
      this.group.add(f);
      foam.push(f);
    }
    const mist = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
      );
      m.position.set(maxX - 2.9, 0.5, POOL.z - 1.6 + (i / 9) * 3.2);
      this.group.add(m);
      mist.push(m);
    }

    const glowLight = new THREE.PointLight(0x80d8ff, 0.9, 14);
    glowLight.position.set(maxX - 4, 1.6, POOL.z);
    this.group.add(glowLight);

    this.animators.push((delta, time) => {
      wtex.offset.y -= delta * 1.1;
      foam.forEach((f, i) => {
        f.position.y = 0.2 + Math.abs(Math.sin(time * 3 + i)) * 0.14;
      });
      mist.forEach((m, i) => {
        const t = (time * 0.35 + i / 10) % 1;
        m.position.y = 0.4 + t * 2.0;
        m.material.opacity = 0.32 * (1 - t);
        m.scale.setScalar(0.7 + t * 0.9);
      });
      rings.forEach((r, i) => {
        const t = (time * 0.45 + i / 3) % 1;
        r.scale.set(0.5 + t * 2.5, 0.5 + t * 2.5, 1);
        r.material.opacity = 0.55 * (1 - t);
      });
    });
  }
}
