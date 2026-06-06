// Données statiques du niveau : pièces, portes, ennemis.
// Pas de dépendances externes.

export const WALL_THICKNESS = 0.25;
export const ROOM_HEIGHT = 3.0;
export const PLAYER_EYE = 1.7;

// Définition des pièces en "inner space" (sol interne, hors murs).
// floorColor : couleur du sol propre à la pièce.
export const ROOMS = {
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

// Portes : ouvertures dans les murs. axis = 'x' (mur orienté nord/sud, traverse en X)
// ou 'z' (mur orienté est/ouest, traverse en Z). pos = coordonnée le long du mur.
// Chaque porte génère un rectangle "doorway" walkable reliant deux pièces.
export const DOORS = [
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

// Position de la clé : sur la commode de la chambre 2.
export const KEY_POSITION = { x: 19.5, y: 0.95, z: 4 };

// Spawns d'ennemis. type = 'caca' | 'poussiere' | 'boss'.
export const ENEMY_SPAWNS = [
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

export const PLAYER_START = { x: 0, z: 0 };

// Bornes globales de la map (pour la minimap).
export function getMapBounds() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const key in ROOMS) {
    const r = ROOMS[key];
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
