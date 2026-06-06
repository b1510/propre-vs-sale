// Données statiques des niveaux : pièces, portes, ennemis, arme, boss.
// Pas de dépendances externes.
//
// Chaque niveau est une config autonome dans le tableau LEVELS.
// Un seul niveau est actif à la fois (reconstruit à chaque transition).

export const WALL_THICKNESS = 0.25;
export const ROOM_HEIGHT = 3.0;
export const PLAYER_EYE = 1.7;

// =====================================================================
// NIVEAU 1 — La villa
// =====================================================================

const LEVEL1_ROOMS = {
  hall:        { minX: -6,  maxX: 6,  minZ: -6,  maxZ: 6,  floorColor: 0x8B7355, label: 'Hall' },
  salon:       { minX: -7,  maxX: 7,  minZ: -18, maxZ: -6, floorColor: 0x9C8466, label: 'Salon' },
  cuisine:     { minX: -17, maxX: -7, minZ: -18, maxZ: -8, floorColor: 0x847150, label: 'Cuisine' },
  chambre1:    { minX: 6,   maxX: 18, minZ: -6,  maxZ: 6,  floorColor: 0x96795B, label: 'Chambre 1' },
  chambre2:    { minX: 18,  maxX: 30, minZ: -6,  maxZ: 6,  floorColor: 0x8E7253, label: 'Chambre 2' },
  chambre3:    { minX: 30,  maxX: 42, minZ: -6,  maxZ: 6,  floorColor: 0x9A7D5F, label: 'Chambre 3' },
  couloir:     { minX: -3,  maxX: 3,  minZ: 6,   maxZ: 14, floorColor: 0x7E6B4D, label: 'Couloir' },
  toilettes:   { minX: 3,   maxX: 13, minZ: 8,   maxZ: 16, floorColor: 0x88764F, label: 'Toilettes' },
  salle_bains: { minX: -13, maxX: -3, minZ: 8,   maxZ: 16, floorColor: 0x8A7858, label: 'Salle de bains' },
  salle_jeu:   { minX: -8,  maxX: 8,  minZ: 14,  maxZ: 28, floorColor: 0x927A57, label: 'Salle de jeu' },
  grenier:     { minX: -9,  maxX: 9,  minZ: 28,  maxZ: 42, floorColor: 0x6E5A3C, label: 'Grenier' },
};

const LEVEL1_DOORS = [
  { id: 'hall_salon',       roomA: 'hall',     roomB: 'salon',     orient: 'z', at: -6, pos: 0,  width: 2.5 },
  { id: 'hall_chambre1',    roomA: 'hall',     roomB: 'chambre1',  orient: 'x', at: 6,  pos: 0,  width: 2.5 },
  { id: 'hall_couloir',     roomA: 'hall',     roomB: 'couloir',   orient: 'z', at: 6,  pos: 0,  width: 2.5 },
  { id: 'salon_cuisine',    roomA: 'salon',    roomB: 'cuisine',   orient: 'x', at: -7, pos: -13, width: 2.5 },
  { id: 'chambre1_chambre2',roomA: 'chambre1', roomB: 'chambre2',  orient: 'x', at: 18, pos: 0,  width: 2.5 },
  { id: 'chambre2_chambre3',roomA: 'chambre2', roomB: 'chambre3',  orient: 'x', at: 30, pos: 0,  width: 2.5 },
  { id: 'couloir_toilettes',roomA: 'couloir',  roomB: 'toilettes', orient: 'x', at: 3,  pos: 11, width: 2.5 },
  { id: 'couloir_bains',    roomA: 'couloir',  roomB: 'salle_bains',orient: 'x', at: -3, pos: 11, width: 2.5 },
  { id: 'couloir_jeu',      roomA: 'couloir',  roomB: 'salle_jeu', orient: 'z', at: 14, pos: 0,  width: 2.5 },
  { id: 'jeu_grenier',      roomA: 'salle_jeu',roomB: 'grenier',   orient: 'z', at: 28, pos: 0,  width: 2.5, locked: true },
];

const LEVEL1_ENEMY_SPAWNS = [
  { room: 'hall',        type: 'caca',      x: 2,   z: -3 },

  { room: 'salon',       type: 'poussiere', x: 3,   z: -14 },
  { room: 'salon',       type: 'poussiere', x: -3,  z: -10 },

  { room: 'cuisine',     type: 'caca',      x: -12, z: -10 },
  { room: 'cuisine',     type: 'poussiere', x: -15, z: -15 },

  { room: 'chambre1',    type: 'caca',      x: 10,  z: -3 },
  { room: 'chambre1',    type: 'caca',      x: 14,  z: 2 },

  { room: 'chambre2',    type: 'poussiere', x: 22,  z: -2 },

  { room: 'chambre3',    type: 'caca',      x: 35,  z: 2 },
  { room: 'chambre3',    type: 'caca',      x: 39,  z: -3 },
  { room: 'chambre3',    type: 'poussiere', x: 37,  z: 0 },

  { room: 'toilettes',   type: 'caca',      x: 9,   z: 13 },

  { room: 'salle_bains', type: 'poussiere', x: -8,  z: 13 },

  { room: 'salle_jeu',   type: 'caca',      x: 4,   z: 18 },
  { room: 'salle_jeu',   type: 'caca',      x: -4,  z: 24 },
  { room: 'salle_jeu',   type: 'poussiere', x: 0,   z: 21 },

  { room: 'grenier',     type: 'boss',      x: 0,   z: 36 },
];

// =====================================================================
// NIVEAU 2 — L'usine de glace
// Grille 4 colonnes × 3 rangées (cellules 12×12).
// Colonnes X : C0[-24,-12] C1[-12,0] C2[0,12] C3[12,24]
// Rangées Z  : R0[-18,-6]  R1[-6,6]  R2[6,18]
// =====================================================================

const LEVEL2_ROOMS = {
  // Rangée nord (R0)
  toilettes2:  { minX: -24, maxX: -12, minZ: -18, maxZ: -6, floorColor: 0x6f7d82, label: 'Toilettes' },
  machines5:   { minX: -12, maxX: 0,   minZ: -18, maxZ: -6, floorColor: 0x9fb6c4, label: 'Salle des machines' },
  dangereuse1: { minX: 0,   maxX: 12,  minZ: -18, maxZ: -6, floorColor: 0x5a4c4c, label: 'Salle dangereuse' },
  dangereuse3: { minX: 12,  maxX: 24,  minZ: -18, maxZ: -6, floorColor: 0x4a3a3a, label: 'Salle du Boss' },
  // Rangée centrale (R1)
  sucree:      { minX: -24, maxX: -12, minZ: -6,  maxZ: 6,  floorColor: 0xe8c8d8, label: 'Salle sucrée' },
  pause:       { minX: -12, maxX: 0,   minZ: -6,  maxZ: 6,  floorColor: 0x8d9b7a, label: 'Salle de pause' },
  machines1:   { minX: 0,   maxX: 12,  minZ: -6,  maxZ: 6,  floorColor: 0x9fb6c4, label: 'Salle des machines' },
  dangereuse2: { minX: 12,  maxX: 24,  minZ: -6,  maxZ: 6,  floorColor: 0x5a4c4c, label: 'Salle dangereuse' },
  // Rangée sud (R2)
  machines4:   { minX: -24, maxX: -12, minZ: 6,   maxZ: 18, floorColor: 0x9fb6c4, label: 'Salle des machines' },
  machines3:   { minX: -12, maxX: 0,   minZ: 6,   maxZ: 18, floorColor: 0x9fb6c4, label: 'Salle des machines' },
  machines2:   { minX: 0,   maxX: 12,  minZ: 6,   maxZ: 18, floorColor: 0x9fb6c4, label: 'Salle des machines' },
  toilettes1:  { minX: 12,  maxX: 24,  minZ: 6,   maxZ: 18, floorColor: 0x6f7d82, label: 'Toilettes' },
};

const LEVEL2_DOORS = [
  // Rangée centrale autour de la salle de pause (départ)
  { id: 'pause_machines1', roomA: 'pause',      roomB: 'machines1',   orient: 'x', at: 0,   pos: 0,   width: 2.5 },
  { id: 'pause_sucree',    roomA: 'pause',      roomB: 'sucree',      orient: 'x', at: -12, pos: 0,   width: 2.5 },
  { id: 'pause_machines5', roomA: 'pause',      roomB: 'machines5',   orient: 'z', at: -6,  pos: -6,  width: 2.5 },
  { id: 'pause_machines3', roomA: 'pause',      roomB: 'machines3',   orient: 'z', at: 6,   pos: -6,  width: 2.5 },
  // Nord
  { id: 'machines5_toil2', roomA: 'machines5',  roomB: 'toilettes2',  orient: 'x', at: -12, pos: -12, width: 2.5 },
  { id: 'machines5_dang1', roomA: 'machines5',  roomB: 'dangereuse1', orient: 'x', at: 0,   pos: -12, width: 2.5 },
  // Est
  { id: 'machines1_dang2', roomA: 'machines1',  roomB: 'dangereuse2', orient: 'x', at: 12,  pos: 0,   width: 2.5 },
  { id: 'dang2_toil1',     roomA: 'dangereuse2',roomB: 'toilettes1',  orient: 'z', at: 6,   pos: 18,  width: 2.5 },
  // Sud
  { id: 'toil1_machines2', roomA: 'toilettes1', roomB: 'machines2',   orient: 'x', at: 12,  pos: 12,  width: 2.5 },
  { id: 'machines2_mach3', roomA: 'machines2',  roomB: 'machines3',   orient: 'x', at: 0,   pos: 12,  width: 2.5 },
  { id: 'machines3_mach4', roomA: 'machines3',  roomB: 'machines4',   orient: 'x', at: -12, pos: 12,  width: 2.5 },
  // Porte du boss — verrouillée jusqu'à récupération de la clé
  { id: 'dang1_dang3',     roomA: 'dangereuse1',roomB: 'dangereuse3', orient: 'x', at: 12,  pos: -12, width: 2.5, locked: true },
];

// 3–4 mobs par pièce (caca + poussiere). +1 pièce via coinBonus du niveau.
const LEVEL2_ENEMY_SPAWNS = [
  { room: 'pause',       type: 'caca',      x: -10, z: -4 },
  { room: 'pause',       type: 'poussiere', x: -2,  z: 4 },
  { room: 'pause',       type: 'caca',      x: -10, z: 4 },

  { room: 'sucree',      type: 'poussiere', x: -21, z: -3 },
  { room: 'sucree',      type: 'caca',      x: -15, z: 3 },
  { room: 'sucree',      type: 'poussiere', x: -18, z: 4 },

  { room: 'machines5',   type: 'caca',      x: -9,  z: -15 },
  { room: 'machines5',   type: 'poussiere', x: -3,  z: -9 },
  { room: 'machines5',   type: 'caca',      x: -9,  z: -9 },

  { room: 'toilettes2',  type: 'poussiere', x: -21, z: -15 },
  { room: 'toilettes2',  type: 'caca',      x: -15, z: -9 },
  { room: 'toilettes2',  type: 'poussiere', x: -18, z: -13 },

  { room: 'dangereuse1', type: 'caca',      x: 3,   z: -15 },
  { room: 'dangereuse1', type: 'caca',      x: 9,   z: -9 },
  { room: 'dangereuse1', type: 'poussiere', x: 6,   z: -10 },

  { room: 'machines1',   type: 'caca',      x: 3,   z: -3 },
  { room: 'machines1',   type: 'poussiere', x: 9,   z: 3 },
  { room: 'machines1',   type: 'caca',      x: 6,   z: 4 },

  { room: 'dangereuse2', type: 'caca',      x: 15,  z: -3 },
  { room: 'dangereuse2', type: 'poussiere', x: 21,  z: 3 },
  { room: 'dangereuse2', type: 'caca',      x: 18,  z: 4 },

  { room: 'machines4',   type: 'poussiere', x: -21, z: 9 },
  { room: 'machines4',   type: 'caca',      x: -15, z: 15 },
  { room: 'machines4',   type: 'poussiere', x: -18, z: 11 },

  { room: 'machines3',   type: 'caca',      x: -9,  z: 9 },
  { room: 'machines3',   type: 'poussiere', x: -3,  z: 15 },
  { room: 'machines3',   type: 'caca',      x: -6,  z: 11 },

  { room: 'machines2',   type: 'caca',      x: 3,   z: 9 },
  { room: 'machines2',   type: 'poussiere', x: 9,   z: 16 },
  { room: 'machines2',   type: 'caca',      x: 9,   z: 9 },

  { room: 'toilettes1',  type: 'poussiere', x: 15,  z: 9 },
  { room: 'toilettes1',  type: 'caca',      x: 21,  z: 15 },
  { room: 'toilettes1',  type: 'poussiere', x: 18,  z: 11 },

  { room: 'dangereuse3', type: 'boss',      x: 18,  z: -12 },
];

// =====================================================================
// Registre des niveaux
// =====================================================================

export const LEVELS = [
  {
    id: 1,
    name: 'La villa',
    rooms: LEVEL1_ROOMS,
    doors: LEVEL1_DOORS,
    enemySpawns: LEVEL1_ENEMY_SPAWNS,
    playerStart: { x: 0, z: 0 },
    keyPosition: { x: 19.5, y: 0.95, z: 4 },   // sur la commode de la chambre 2
    lockedDoorId: 'jeu_grenier',
    bossType: 'tacos',
    bossRoom: 'grenier',
    bossLabel: 'BOSS TACOS',
    weapon: { build: 'plumeau', meleeDamage: 20, meleeRange: 2.5 },
    coinBonus: 0,
    background: 0x1a1d24,
  },
  {
    id: 2,
    name: "L'usine de glace",
    rooms: LEVEL2_ROOMS,
    doors: LEVEL2_DOORS,
    enemySpawns: LEVEL2_ENEMY_SPAWNS,
    playerStart: { x: -6, z: 0 },               // salle de pause
    keyPosition: { x: 6, y: 1.15, z: 14 },       // sur une machine de la salle machines2
    lockedDoorId: 'dang1_dang3',
    bossType: 'burger',
    bossRoom: 'dangereuse3',
    bossLabel: 'BOSS BURGER',
    weapon: { build: 'aspirateur', meleeDamage: 35, meleeRange: 2.8 },
    coinBonus: 1,
    background: 0x10141c,
  },
];

// Bornes globales d'un ensemble de pièces (pour la minimap).
export function getMapBounds(rooms) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const key in rooms) {
    const r = rooms[key];
    minX = Math.min(minX, r.minX);
    maxX = Math.max(maxX, r.maxX);
    minZ = Math.min(minZ, r.minZ);
    maxZ = Math.max(maxZ, r.maxZ);
  }
  return { minX, maxX, minZ, maxZ };
}

// Rectangle walkable d'une porte (en world XZ). Élargi en épaisseur pour
// couvrir le mur et un peu de chaque côté afin que la collision axiale passe.
export function getDoorwayRect(door) {
  const halfW = door.width / 2;
  const pad = WALL_THICKNESS + 0.6; // marge de passage de part et d'autre du mur
  if (door.orient === 'x') {
    // mur vertical à x = door.at, on traverse en X autour de z = door.pos
    return {
      minX: door.at - pad, maxX: door.at + pad,
      minZ: door.pos - halfW, maxZ: door.pos + halfW,
    };
  } else {
    // mur horizontal à z = door.at, on traverse en Z autour de x = door.pos
    return {
      minX: door.pos - halfW, maxX: door.pos + halfW,
      minZ: door.at - pad, maxZ: door.at + pad,
    };
  }
}
