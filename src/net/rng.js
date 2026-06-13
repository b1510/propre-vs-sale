// RNG deterministe partage entre clients (meme seed -> meme suite de nombres).
// Sert a generer une disposition de taches identique chez tous les joueurs.

// Generateur mulberry32 : rapide, 32 bits, qualite suffisante pour du gameplay.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
