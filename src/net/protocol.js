// Constantes des types de messages reseau (cote client).
// Refletent le protocole gere par server/index.js.

export const MSG = {
  // Lobby (client -> serveur)
  CREATE: 'create',
  JOIN: 'join',
  SET_READY: 'setReady',
  SET_MODE: 'setMode',
  START: 'start',
  LEAVE: 'leave',

  // Lobby (serveur -> client)
  JOINED: 'joined',
  PLAYERS: 'players',
  MODE: 'mode',
  ERROR: 'error',
  HOST_LEFT: 'hostLeft',

  // In-game (relayes)
  STATE: 'state',         // transform d'un joueur
  WORLD: 'world',         // snapshot host (ennemis / projectiles / taches)
  CLEAN: 'clean',         // taches nettoyees par un client
  ENEMY_HIT: 'enemyHit',  // un client a frappe un ennemi (coop -> host)
  HIT: 'hit',             // degats PvE infliges a un joueur (depuis le host)
  PVP_HIT: 'pvpHit',      // degats joueur -> joueur
  ENEMY_KILLED: 'enemyKilled',
  SWING: 'swing',         // animation de coup
  DIED: 'died',
  RESPAWN: 'respawn',
  LEVEL_CHANGE: 'levelChange',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
  CHAT: 'chat',
};

export const MODE = { COOP: 'coop', PVP: 'pvp' };
